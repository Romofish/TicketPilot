"""A passive observer. No interaction, refresh loop, or authenticated state export."""

import asyncio
import os
import time
from collections import Counter
from collections.abc import Callable
from urllib.parse import urlsplit

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from backend.services.browser_profiles import BrowserProfileError, BrowserProfiles, ProfileLease
from backend.services.redaction import sanitized_url
from backend.settings import Settings

# Only tag semantics, visibility, and boolean hints are returned from the page.
# These are not ticket platform selectors, a seat map parser, or verified page types.
OBSERVE_SCRIPT = """() => {
    const visible = el => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' &&
            rect.width > 0 && rect.height > 0;
    };
    const count = selector => [...document.querySelectorAll(selector)].filter(visible).length;
    const password = [...document.querySelectorAll('input[type="password"]')].some(visible);
    const bodyText = document.body?.innerText || '';
    const challenge = /captcha|verify you are human|waiting room|you are in (a |the )?queue/i.test(bodyText);
    const entry = performance.getEntriesByType('navigation')[0];
    const metric = value => Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
    return {
        page_type: password ? 'login_form' : challenge ? 'verification_or_queue' : 'unknown',
        seat_state: 'unverified',
        visible_counts: {
            buttons: count('button,[role="button"]'), links: count('a'),
            inputs: count('input,select,textarea'), images: count('img'), frames: count('iframe')
        },
        evidence: {
            login_input_visible: password,
            challenge_or_queue_text_visible: challenge,
            document_title_present: Boolean(document.title),
            classification: 'generic_unverified_heuristic',
            scope: 'main_document_only'
        },
        timing: {
            dom_content_loaded_ms: entry ? metric(entry.domContentLoadedEventEnd) : null,
            load_ms: entry ? metric(entry.loadEventEnd) : null,
            response_ms: entry ? metric(entry.responseEnd) : null
        }
    };
}"""


class BrowserObserver:
    def __init__(self, settings: Settings, emit: Callable[[str, dict], None], *, platform: str = "allticket"):
        self.settings = settings
        self.platform = platform
        self.emit = emit
        self.playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self.closed = False
        self._closing = False
        self._tasks: set[asyncio.Task] = set()
        self._console: Counter = Counter()
        self._profile_lease: ProfileLease | None = None
        self._attached_pages: set[Page] = set()
        self._browser_launch_started = False

    async def open(self, url: str) -> dict:
        if not self.settings.headless and not self.settings.display_available:
            raise RuntimeError("display_unavailable")
        profile_path = None
        if self.settings.persistent_browser_session:
            profiles = BrowserProfiles(self.settings)
            try:
                self._profile_lease = profiles.acquire(self.platform)
                profile_path = profiles.path(self.platform, create=True)
            except OSError:
                raise BrowserProfileError() from None
        self.playwright = await async_playwright().start()
        launch: dict = {"headless": self.settings.headless}
        if self.settings.browser_executable_path:
            launch["executable_path"] = self.settings.browser_executable_path
        proxy_url = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
        if proxy_url:
            parsed = urlsplit(proxy_url)
            if parsed.hostname:
                launch["proxy"] = {
                    "server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port or 8080}",
                    "bypass": os.environ.get("NO_PROXY", "localhost,127.0.0.1,::1"),
                }
                if parsed.username:
                    launch["proxy"]["username"] = parsed.username
                if parsed.password:
                    launch["proxy"]["password"] = parsed.password
        self._browser_launch_started = True
        if profile_path is not None:
            self.context = await self.playwright.chromium.launch_persistent_context(
                str(profile_path), **launch
            )
        else:
            self.browser = await self.playwright.chromium.launch(**launch)
            self.browser.on("disconnected", self._disconnected)
            self.context = await self.browser.new_context()
        self.context.on("close", self._disconnected)
        self.context.on("page", self._attach)
        for existing_page in self.context.pages:
            self._attach(existing_page)
        page = self.page or await self.context.new_page()
        response = await page.goto(
            url, wait_until="domcontentloaded", timeout=self.settings.navigation_timeout_ms
        )
        if response:
            self.emit("navigation_response", {"status_code": response.status})
        return await self.capture()

    def _disconnected(self) -> None:
        if not self._closing and not self.closed:
            self.closed = True
            self.emit("browser_closed", {"reason": "browser_window_closed"})

    def _attach(self, page: Page) -> None:
        if page in self._attached_pages:
            return
        self._attached_pages.add(page)
        self.page = page
        page.on("console", self._on_console)
        page.on("pageerror", lambda _: self.emit("page_error", {"category": "javascript_error"}))
        page.on("requestfailed", lambda request: self.emit(
            "request_failed", {"resource_type": request.resource_type}
        ))
        page.on("load", lambda: self._schedule_observation(page))
        page.on("close", lambda: self._page_closed(page))

    def _page_closed(self, page: Page) -> None:
        self._attached_pages.discard(page)
        if self._closing:
            return
        pages = [candidate for candidate in self.context.pages if not candidate.is_closed()] if self.context else []
        self.page = pages[-1] if pages else None
        if not pages and not self.closed:
            self.closed = True
            self.emit("browser_closed", {"reason": "all_pages_closed"})

    def _on_console(self, message) -> None:
        category = message.type if message.type in {"log", "warning", "error", "info", "debug"} else "other"
        self._console[category] += 1
        # Text, arguments, stack locations and request data never cross the boundary.

    def _schedule_observation(self, page: Page) -> None:
        if self._closing:
            return
        task = asyncio.create_task(self._observe_loaded(page))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _observe_loaded(self, page: Page) -> None:
        try:
            data = await self._capture_page(page)
            self.emit("page_loaded", data)
        except Exception:
            if not self._closing:
                self.emit("observation_error", {"category": "page_changed_during_observation"})

    async def _capture_page(self, page: Page) -> dict:
        started = time.perf_counter()
        data = await page.evaluate(OBSERVE_SCRIPT)
        data["timing"]["observation_ms"] = round((time.perf_counter() - started) * 1000, 2)
        data["url"] = sanitized_url(page.url)
        data["console_counts"] = dict(self._console)
        return data

    async def capture(self) -> dict:
        if self.closed or not self.page or self.page.is_closed():
            raise RuntimeError("browser_closed")
        return await self._capture_page(self.page)

    async def close(self) -> None:
        if self._closing:
            return
        self._closing = True
        self.closed = True
        for task in tuple(self._tasks):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        browser_stopped = not self._browser_launch_started
        driver_stopped = self.playwright is None
        try:
            try:
                if self.context:
                    await self.context.close()
                    # Closing a persistent context also closes its browser.
                    browser_stopped = self.settings.persistent_browser_session
            finally:
                if self.browser:
                    await self.browser.close()
                    browser_stopped = True
        finally:
            try:
                if self.playwright:
                    await self.playwright.stop()
                    driver_stopped = True
            finally:
                # Keep a failed cleanup locked until process exit; never delete live data.
                if self._profile_lease and (browser_stopped or driver_stopped):
                    self._profile_lease.release()
                    self._profile_lease = None
