"""Exercise the real React app using local-only, simulated research API responses."""

import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

import pytest
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.browser


@pytest.fixture(scope="module")
def frontend_url(tmp_path_factory):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    with (tmp_path_factory.mktemp("vite") / "server.log").open("w") as output:
        process = subprocess.Popen(
            ["node", "node_modules/vite/bin/vite.js", "--config", "frontend/vite.config.ts",
             "--port", str(port), "--strictPort"],
            cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
        )
        try:
            for _ in range(100):
                if process.poll() is not None:
                    pytest.fail("Vite exited before becoming ready")
                try:
                    with urlopen(url, timeout=0.3) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.1)
            else:
                pytest.fail("Vite did not start within 10 seconds")
            yield url
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


async def mock_api(page, *, desktop=True):
    sessions = []
    events = []
    mutations = []

    async def handler(route):
        request = route.request
        path = request.url.split("/api", 1)[1]
        body = request.post_data_json if request.method == "POST" and request.post_data else {}
        status = 200
        if request.method == "POST":
            mutations.append(path)
        if path == "/config":
            result = {"platforms": [{"id": "allticket", "label": "ALL TICKET"},
                                     {"id": "ttm", "label": "ThaiTicketMajor"}],
                      "browser_mode": "headed", "display_available": desktop,
                      "max_active_sessions": 1, "capture_cooldown_seconds": 3}
        elif path == "/research/sessions" and request.method == "POST":
            session = {"id": "local-fixture-session", "platform": body["platform"],
                       "url": "https://www.allticket.com/[redacted-path]",
                       "event_name": body.get("event_name", ""), "status": "active",
                       "started_at": "2026-10-17T03:00:00+08:00", "ended_at": None, "error": None}
            sessions.append(session)
            result, status = session, 201
        elif path == "/research/sessions":
            result = {"sessions": sessions}
        elif path.endswith("/capture") or path.endswith("/markers"):
            data = ({"page_type": "unknown", "seat_state": "unverified",
                     "visible_counts": {"buttons": 3, "links": 1, "inputs": 2},
                     "timing": {"dom_content_loaded_ms": 123, "load_ms": 150, "response_ms": 42}}
                    if path.endswith("/capture") else {"label": body["label"]})
            event = {"id": len(events) + 1, "session_id": sessions[0]["id"],
                     "kind": "page_observation" if path.endswith("/capture") else "manual_marker",
                     "created_at": "2026-10-17T03:00:05+08:00", "data": data}
            events.append(event)
            result, status = event, 201
        elif path.endswith("/close"):
            sessions[0]["status"] = "closed"
            sessions[0]["ended_at"] = "2026-10-17T03:01:00+08:00"
            result = sessions[0]
        elif path.endswith("/events"):
            result = {"events": events}
        elif path.endswith("/export"):
            result = {"schema_version": 1, "session": sessions[0], "events": events}
        else:
            result, status = {"detail": "Unknown local fixture endpoint"}, 404
        await route.fulfill(status=status, json=result)

    await page.route("**/api/**", handler)
    return mutations


@pytest.fixture
async def page():
    executable = os.environ.get("TICKETPILOT_BROWSER_EXECUTABLE_PATH") or shutil.which("chromium")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, executable_path=executable)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1000}, timezone_id="Asia/Shanghai"
        )
        page = await context.new_page()
        yield page
        await browser.close()


async def test_research_launch_capture_marker_export_and_close(page, frontend_url, tmp_path):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    mutations = await mock_api(page)
    await page.goto(frontend_url)
    await expect(page.get_by_role("radio", name="ALL TICKET")).to_be_checked()
    await page.get_by_label("活动 URL").fill("https://www.allticket.com/event/local-fixture")
    await page.get_by_label("研究名称").fill("本地流程测试")
    await page.get_by_role("button", name="打开研究浏览器").click()
    await expect(page.get_by_role("heading", name="本地流程测试")).to_be_visible()
    await page.get_by_role("button", name="记录当前页面").click()
    await expect(page.get_by_text("150 ms", exact=True)).to_be_visible()
    await expect(page.get_by_text("未知页面", exact=True)).to_be_visible()
    await page.get_by_role("button", name="T1", exact=False).click()
    await expect(page.get_by_text("人工时间标记 · T1", exact=True)).to_be_visible()
    async with page.expect_download() as download_info:
        await page.get_by_role("button", name="导出脱敏 JSON").click()
    download = await download_info.value
    filename = tmp_path / download.suggested_filename
    await download.save_as(filename)
    exported = json.loads(filename.read_text())
    assert exported["schema_version"] == 1
    assert len(exported["events"]) == 2
    Path("test-results").mkdir(exist_ok=True)
    await page.screenshot(path="test-results/workspace-desktop.png", full_page=True)
    await page.get_by_role("button", name="结束会话").click()
    await expect(page.get_by_role("button", name="记录当前页面")).to_be_disabled()
    assert mutations == ["/research/sessions", "/research/sessions/local-fixture-session/capture",
                         "/research/sessions/local-fixture-session/markers",
                         "/research/sessions/local-fixture-session/close"]
    assert not errors


async def test_mobile_workspace_has_no_horizontal_overflow(page, frontend_url):
    await page.set_viewport_size({"width": 390, "height": 844})
    await mock_api(page)
    await page.goto(frontend_url)
    await expect(page.get_by_role("button", name="打开研究浏览器")).to_be_enabled()
    assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    Path("test-results").mkdir(exist_ok=True)
    await page.screenshot(path="test-results/workspace-mobile.png", full_page=True)


async def test_no_display_explains_local_manual_login_requirement(page, frontend_url):
    await mock_api(page, desktop=False)
    await page.goto(frontend_url)
    await expect(page.get_by_role("button", name="打开研究浏览器")).to_be_disabled()
    await expect(page.get_by_role("note")).to_contain_text("未检测到桌面")
