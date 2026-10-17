import asyncio
import time
from collections.abc import Callable

from fastapi import HTTPException
from playwright.async_api import TimeoutError as BrowserTimeout

from backend.adapters import ADAPTERS
from backend.models.research import OpenSession
from backend.services.browser import BrowserObserver
from backend.services.browser_profiles import (
    BrowserProfileBusy,
    BrowserProfileError,
    BrowserProfiles,
)
from backend.settings import Settings
from backend.storage.repository import Repository


class ResearchService:
    def __init__(self, settings: Settings, repository: Repository, factory: Callable = BrowserObserver):
        self.settings = settings
        self.repository = repository
        self.factory = factory
        self.browsers: dict[str, BrowserObserver] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        self.cleanup_tasks: set[asyncio.Task] = set()
        self.disposals: dict[str, asyncio.Task] = {}
        self.last_capture: dict[str, float] = {}
        self.lock = asyncio.Lock()
        self.profiles = BrowserProfiles(settings)

    def _browser_in_use(self) -> bool:
        return bool(self.browsers or self.disposals or any(
            session["status"] in {"active", "opening"} for session in self.repository.list()
        ))

    def profile_status(self, platform: str) -> dict:
        try:
            return self.profiles.status(platform, browser_in_use=self._browser_in_use())
        except (BrowserProfileError, OSError):
            raise HTTPException(503, "无法访问应用专用浏览器数据；请检查数据目录及权限。") from None

    async def clear_profile(self, platform: str) -> dict:
        async with self.lock:
            if self._browser_in_use():
                raise HTTPException(409, "请先关闭浏览器并等待清理完成，再清除已保存的数据。")
            try:
                self.profiles.clear(platform)
            except BrowserProfileBusy:
                raise HTTPException(409, "浏览器数据正在使用；请关闭使用该数据的 TicketPilot 后重试。") from None
            except (BrowserProfileError, OSError):
                raise HTTPException(503, "无法清除应用专用浏览器数据；请检查数据目录及权限。") from None
            return self.profile_status(platform)

    def get(self, session_id: str) -> dict:
        session = self.repository.get(session_id)
        if not session:
            raise HTTPException(404, "研究会话不存在。")
        return session

    def _emit(self, session_id: str, kind: str, data: dict) -> None:
        session = self.repository.get(session_id)
        if session and session["status"] in {"active", "opening"}:
            self.repository.add_event(session_id, kind, data)
            if kind == "browser_closed":
                self.repository.update(session_id, "closed")
                task = asyncio.create_task(self._dispose(session_id))
                self.cleanup_tasks.add(task)
                task.add_done_callback(self.cleanup_tasks.discard)

    async def create(self, request: OpenSession) -> dict:
        try:
            url = ADAPTERS[request.platform].validate_url(request.url)
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        if not self.settings.headless and not self.settings.display_available:
            raise HTTPException(
                503, "当前环境没有可交互桌面。请在本机桌面运行后端并保持 HEADLESS=false，"
                "然后在打开的浏览器中人工登录；云环境需要远程桌面才能人工登录。"
            )
        async with self.lock:
            if self._browser_in_use():
                raise HTTPException(409, "请先关闭当前研究会话；一次仅允许一个浏览器会话。")
            session = self.repository.create_session(request.platform, url, request.event_name)
            session_id = session["id"]
            try:
                browser = self.factory(
                    self.settings, lambda kind, data: self._emit(session_id, kind, data),
                    platform=request.platform,
                )
            except Exception:
                self.repository.add_event(session_id, "session_error", {"category": "browser_start_failed"})
                return self.repository.update(session_id, "failed", "浏览器初始化失败；请检查本地配置后重试。")
            self.browsers[session_id] = browser
            self.tasks[session_id] = asyncio.create_task(self._open(session_id, url, browser))
            return session

    async def _open(self, session_id: str, url: str, browser: BrowserObserver) -> None:
        try:
            capture = await browser.open(url)
            if self.get(session_id)["status"] != "opening":
                return
            self.repository.update(session_id, "active")
            self.repository.add_event(session_id, "page_observation", capture)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if self.get(session_id)["status"] not in {"closed", "failed"}:
                if isinstance(error, BrowserProfileBusy):
                    category = error.category
                    message = "应用专用浏览器数据正在使用；请先关闭另一 TicketPilot 会话。"
                elif isinstance(error, BrowserProfileError):
                    category = error.category
                    message = "无法访问应用专用浏览器数据；请检查数据目录及权限。"
                elif isinstance(error, BrowserTimeout):
                    category = "navigation_timeout"
                    message = "页面加载超时；已保留错误分类，请关闭后检查连接并重新打开。"
                else:
                    category = "browser_start_failed"
                    message = "浏览器打开失败；请检查 Playwright 浏览器安装、网络和桌面配置。"
                self.repository.add_event(session_id, "session_error", {"category": category})
                self.repository.update(session_id, "failed", message)
        finally:
            if self.get(session_id)["status"] != "active":
                await self._dispose(session_id)

    async def _dispose(self, session_id: str) -> None:
        task = self.disposals.get(session_id)
        if task is None:
            browser = self.browsers.get(session_id)
            if browser is None:
                return
            task = asyncio.create_task(self._close_browser(session_id, browser))
            self.disposals[session_id] = task
        # Keep the reservation until cleanup finishes, even when opening/close is cancelled.
        await asyncio.shield(task)

    async def _close_browser(self, session_id: str, browser: BrowserObserver) -> None:
        try:
            await browser.close()
        except Exception:
            # Browser errors may embed full URLs, local paths or credentials.
            self.repository.add_event(session_id, "session_error", {"category": "browser_cleanup_failed"})
        finally:
            self.browsers.pop(session_id, None)
            self.disposals.pop(session_id, None)

    def _active(self, session_id: str) -> BrowserObserver:
        session = self.get(session_id)
        browser = self.browsers.get(session_id)
        if session["status"] != "active" or not browser or browser.closed:
            raise HTTPException(409, "会话当前不可观察；请等待打开完成或新建会话。")
        return browser

    async def capture(self, session_id: str) -> dict:
        browser = self._active(session_id)
        now = time.monotonic()
        previous = self.last_capture.get(session_id)
        if previous is not None and now - previous < self.settings.capture_cooldown_seconds:
            raise HTTPException(429, f"请等待 {self.settings.capture_cooldown_seconds:g} 秒后再记录页面。")
        self.last_capture[session_id] = now
        try:
            data = await browser.capture()
            if self.get(session_id)["status"] != "active":
                raise HTTPException(409, "会话已关闭。")
            return self.repository.add_event(session_id, "page_observation", data)
        except HTTPException:
            raise
        except Exception:
            self.repository.add_event(session_id, "observation_error", {"category": "capture_failed"})
            raise HTTPException(409, "页面在观察时变化或已关闭；请检查浏览器后重试。") from None

    def marker(self, session_id: str, label: str) -> dict:
        self._active(session_id)
        return self.repository.add_event(session_id, "manual_marker", {
            "label": label, "meaning": "user_reported_observation_only"
        })

    async def close(self, session_id: str) -> dict:
        async with self.lock:
            session = self.get(session_id)
            if session["status"] not in {"closed", "failed"}:
                self.repository.add_event(session_id, "session_closed", {"reason": "user_requested"})
                self.repository.update(session_id, "closed")
            task = self.tasks.pop(session_id, None)
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            await self._dispose(session_id)
            self.last_capture.pop(session_id, None)
            return self.get(session_id)

    async def shutdown(self) -> None:
        for session_id in set(self.browsers) | set(self.tasks):
            await self.close(session_id)
        if self.cleanup_tasks:
            await asyncio.gather(*self.cleanup_tasks, return_exceptions=True)
