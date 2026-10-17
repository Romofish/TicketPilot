from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.browser import BrowserObserver
from backend.services.browser_profiles import BrowserProfiles
from backend.settings import Settings


@pytest.mark.asyncio
@pytest.mark.parametrize("driver_cleanup_fails", [False, True])
async def test_failed_persistent_launch_keeps_lease_until_driver_cleanup(tmp_path, monkeypatch, driver_cleanup_fails):
    settings = Settings(_env_file=None, data_dir=tmp_path, headless=True, persistent_browser_session=True)
    profiles = BrowserProfiles(settings)
    driver = SimpleNamespace(
        chromium=SimpleNamespace(launch_persistent_context=AsyncMock(side_effect=RuntimeError("synthetic launch failure"))),
        stop=AsyncMock(side_effect=RuntimeError("synthetic cleanup failure") if driver_cleanup_fails else None),
    )
    monkeypatch.setattr("backend.services.browser.async_playwright", lambda: SimpleNamespace(start=AsyncMock(return_value=driver)))
    observer = BrowserObserver(settings, lambda *_args: None)
    try:
        with pytest.raises(RuntimeError, match="synthetic launch failure"):
            await observer.open("http://127.0.0.1/fixture-never-requested")
        assert observer.context is None
        assert profiles.status("allticket")["browser_in_use"] is True
        if driver_cleanup_fails:
            with pytest.raises(RuntimeError, match="synthetic cleanup failure"):
                await observer.close()
        else:
            await observer.close()
        assert profiles.status("allticket")["browser_in_use"] is driver_cleanup_fails
        driver.stop.assert_awaited_once()
    finally:
        if observer._profile_lease:
            observer._profile_lease.release()


@pytest.mark.asyncio
@pytest.mark.parametrize("context_cleanup_fails,driver_cleanup_fails", [(True, False), (False, True), (True, True)])
async def test_persistent_context_close_flushes_and_retains_lease_when_all_cleanup_fails(
    tmp_path, context_cleanup_fails, driver_cleanup_fails
):
    settings = Settings(_env_file=None, data_dir=tmp_path, headless=True, persistent_browser_session=True)
    profiles = BrowserProfiles(settings)
    observer = BrowserObserver(settings, lambda *_args: None)
    observer._profile_lease = profiles.acquire("allticket")
    observer._browser_launch_started = True
    observer.context = SimpleNamespace(close=AsyncMock(
        side_effect=RuntimeError("synthetic context cleanup failure") if context_cleanup_fails else None
    ))
    observer.playwright = SimpleNamespace(stop=AsyncMock(
        side_effect=RuntimeError("synthetic driver cleanup failure") if driver_cleanup_fails else None
    ))
    try:
        with pytest.raises(RuntimeError, match="synthetic"):
            await observer.close()
        observer.context.close.assert_awaited_once()
        observer.playwright.stop.assert_awaited_once()
        assert profiles.status("allticket")["browser_in_use"] is (context_cleanup_fails and driver_cleanup_fails)
    finally:
        if observer._profile_lease:
            observer._profile_lease.release()
