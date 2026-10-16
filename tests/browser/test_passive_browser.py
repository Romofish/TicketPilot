import json
import os
import shutil
import threading
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from backend.services.browser import BrowserObserver
from backend.settings import Settings


@pytest.fixture
def fixture_server():
    body = (Path(__file__).parent / "fixtures" / "research.html").read_bytes()
    requests = Counter()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests[self.path] += 1
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            requests["POST " + self.path] += 1
            self.send_response(500)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}", requests
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


@pytest.mark.asyncio
async def test_real_chromium_observes_local_fixture_without_interaction_or_secrets(tmp_path, fixture_server):
    origin, requests = fixture_server
    executable = os.environ.get("TICKETPILOT_BROWSER_EXECUTABLE_PATH") or shutil.which("chromium")
    events = []
    observer = BrowserObserver(
        Settings(data_dir=tmp_path, headless=True, browser_executable_path=executable),
        lambda kind, data: events.append({"kind": kind, "data": data}),
    )
    try:
        # A direct fixture-only observer; production API never accepts localhost URLs.
        first = await observer.open(origin + "/research?token=private-query")
        await observer.page.wait_for_load_state("load")
        capture = await observer.capture()
        assert first["page_type"] == "login_form"
        assert capture["seat_state"] == "unverified"
        assert capture["visible_counts"]["buttons"] == 1
        assert capture["visible_counts"]["inputs"] == 2
        assert capture["timing"]["dom_content_loaded_ms"] > 0
        assert capture["timing"]["load_ms"] > 0
        assert capture["console_counts"]["log"] == 1
        assert capture["console_counts"]["error"] == 1
        assert await observer.page.evaluate("window.orderInteractions") == 0
        assert not any("/order" in request for request in requests)
        assert requests["/research?token=private-query"] == 1
        serialized = json.dumps([first, capture, events])
        for secret in ["person@example.com", "private-password", "private-bearer-token", "private-query", "66812345678"]:
            assert secret not in serialized
        assert not list(tmp_path.iterdir())  # No HAR, screenshot, trace, or browser storage exported.
    finally:
        await observer.close()
    assert observer.closed


@pytest.mark.asyncio
async def test_new_tab_is_observed_and_manual_close_is_reported(tmp_path, fixture_server):
    origin, _requests = fixture_server
    executable = os.environ.get("TICKETPILOT_BROWSER_EXECUTABLE_PATH") or shutil.which("chromium")
    events = []
    observer = BrowserObserver(
        Settings(data_dir=tmp_path, headless=True, browser_executable_path=executable),
        lambda kind, data: events.append({"kind": kind, "data": data}),
    )
    try:
        await observer.open(origin + "/first")
        first_page = observer.page
        second_page = await observer.context.new_page()
        await second_page.goto(origin + "/second")
        assert observer.page == second_page
        assert (await observer.capture())["seat_state"] == "unverified"
        await second_page.close()
        assert observer.page == first_page
        await first_page.close()
        assert observer.closed
        assert any(event["kind"] == "browser_closed" for event in events)
    finally:
        await observer.close()
