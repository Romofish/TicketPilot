import asyncio
import json
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from playwright.async_api import TimeoutError as BrowserTimeout

from backend.main import create_app
from backend.models.research import OpenSession
from backend.services.research import ResearchService
from backend.settings import Settings
from backend.storage.repository import Repository

CAPTURE = {
    "page_type": "unknown", "seat_state": "unverified", "visible_counts": {"buttons": 2},
    "evidence": {"classification": "generic_unverified_heuristic"},
    "timing": {"dom_content_loaded_ms": 25, "load_ms": 40},
}


class FakeBrowser:
    instances = []

    def __init__(self, _settings, emit, *, platform="allticket"):
        self.platform = platform
        self.closed = False
        self.emit = emit
        self.capture_count = 0
        self.__class__.instances.append(self)

    async def open(self, _url):
        return CAPTURE

    async def capture(self):
        self.capture_count += 1
        return CAPTURE

    async def close(self):
        self.closed = True


@pytest.fixture
def client(tmp_path):
    settings = Settings(data_dir=tmp_path, headless=True)
    with TestClient(create_app(settings, FakeBrowser), base_url="http://localhost:8000") as client:
        yield client


def opened(client):
    response = client.post("/api/research/sessions", json={
        "platform": "allticket", "url": "https://www.allticket.com/event/private-token?token=secret",
        "event_name": "Demo event",
    })
    assert response.status_code == 201
    session_id = response.json()["id"]
    for _ in range(100):
        if client.get(f"/api/research/sessions/{session_id}").json()["status"] != "opening":
            return session_id
        time.sleep(0.01)
    pytest.fail("fake browser opening timed out")


def test_research_lifecycle_export_and_passive_markers(client):
    assert client.get("/api/config").json()["platforms"][0]["id"] == "allticket"
    session_id = opened(client)
    path = f"/api/research/sessions/{session_id}"
    assert client.get(path).json()["status"] == "active"
    assert client.post(path + "/capture").status_code == 201
    assert client.post(path + "/capture").status_code == 429
    marker = client.post(path + "/markers", json={"label": "T2"})
    assert marker.status_code == 201
    assert marker.json()["data"]["meaning"] == "user_reported_observation_only"
    exported = client.get(path + "/export").json()
    assert exported["schema_version"] == 1
    assert "private-token" not in json.dumps(exported)
    assert "?token=" not in json.dumps(exported)
    assert exported["events"][0]["data"]["seat_state"] == "unverified"
    assert client.post(path + "/close").json()["status"] == "closed"
    assert FakeBrowser.instances[-1].closed
    assert client.post(path + "/close").status_code == 200
    assert client.post(path + "/capture").status_code == 409


def test_single_session_and_input_validation(client):
    opened(client)
    assert client.post("/api/research/sessions", json={"url": "https://allticket.com/event"}).status_code == 409
    response = client.post("/api/research/sessions", json={"url": "https://user:secret@allticket.com/event"})
    assert response.status_code == 422
    assert "secret" not in response.text
    assert client.post("/api/research/sessions", json={"platform": "secret", "url": 123}).status_code == 422
    validation = client.post("/api/research/sessions", json={"url": {"secret": "private"}})
    assert "private" not in validation.text
    unknown_key = client.post("/api/research/sessions", json={
        "url": "https://allticket.com/event", "private-sensitive-extra-key": "secret"
    })
    assert unknown_key.status_code == 422
    assert "private-sensitive-extra-key" not in unknown_key.text
    assert client.get("/api/research/sessions/missing").status_code == 404


def test_reject_remote_origins_and_dns_rebinding(client):
    assert client.post("/api/research/sessions", headers={"Origin": "https://evil.test"}, json={
        "url": "https://allticket.com/event"
    }).status_code == 403
    assert client.post("/api/research/sessions", headers={"Sec-Fetch-Site": "cross-site"}, json={
        "url": "https://allticket.com/event"
    }).status_code == 403
    assert client.get("/api/health", headers={"Host": "evil.test"}).status_code == 400
    assert client.get("/api/config", headers={"Origin": "http://localhost:5173"}).status_code == 200


def test_missing_display_is_actionable_and_never_switches_to_headless(tmp_path, monkeypatch):
    monkeypatch.delenv("DISPLAY", raising=False)
    monkeypatch.delenv("WAYLAND_DISPLAY", raising=False)
    monkeypatch.setattr("backend.settings.sys.platform", "linux")
    with TestClient(create_app(Settings(data_dir=tmp_path, headless=False), FakeBrowser), base_url="http://localhost:8000") as client:
        assert client.get("/api/config").json()["browser_mode"] == "headed"
        response = client.post("/api/research/sessions", json={"url": "https://allticket.com/event"})
        assert response.status_code == 503
        assert "人工登录" in response.json()["detail"]
        assert client.get("/api/research/sessions").json() == {"sessions": []}


def test_failure_redacted_and_browser_closed(tmp_path):
    class FailedBrowser(FakeBrowser):
        async def open(self, _url):
            raise BrowserTimeout("https://allticket.com/?token=private-session Cookie=private-cookie")

    with TestClient(create_app(Settings(data_dir=tmp_path, headless=True), FailedBrowser), base_url="http://localhost:8000") as client:
        session_id = opened(client)
        export = client.get(f"/api/research/sessions/{session_id}/export")
        assert export.json()["session"]["status"] == "failed"
        assert export.json()["events"][0]["data"]["category"] == "navigation_timeout"
        assert "private-session" not in export.text
        assert "private-cookie" not in export.text
        assert FailedBrowser.instances[-1].closed


def test_close_while_opening_does_not_resurrect_or_leak_browser(tmp_path):
    class SlowBrowser(FakeBrowser):
        async def open(self, _url):
            await asyncio.Event().wait()

    with TestClient(create_app(Settings(data_dir=tmp_path, headless=True), SlowBrowser), base_url="http://localhost:8000") as client:
        response = client.post("/api/research/sessions", json={"url": "https://allticket.com/event"})
        path = f"/api/research/sessions/{response.json()['id']}"
        assert response.json()["status"] == "opening"
        assert client.post(path + "/close").json()["status"] == "closed"
        assert SlowBrowser.instances[-1].closed
        assert client.get(path).json()["status"] == "closed"
        assert client.get(path + "/events").json()["events"][0]["kind"] == "session_closed"


def test_shutdown_closes_active_browser(tmp_path):
    with TestClient(create_app(Settings(data_dir=tmp_path, headless=True), FakeBrowser), base_url="http://localhost:8000") as client:
        opened(client)
        browser = FakeBrowser.instances[-1]
        assert not browser.closed
    assert browser.closed


@pytest.mark.asyncio
@pytest.mark.parametrize("close_reason", ["navigation_failure", "manual_browser_close"])
async def test_session_slot_reserved_until_browser_cleanup_completes(tmp_path, close_reason):
    cleanup_started = asyncio.Event()
    allow_cleanup = asyncio.Event()

    class DelayedCleanupBrowser(FakeBrowser):
        instances = []

        async def open(self, _url):
            if len(self.instances) == 1 and close_reason == "navigation_failure":
                raise RuntimeError("private navigation error")
            return CAPTURE

        async def close(self):
            cleanup_started.set()
            await allow_cleanup.wait()
            self.closed = True

    settings = Settings(data_dir=tmp_path, headless=True)
    repository = Repository(tmp_path)
    service = ResearchService(settings, repository, DelayedCleanupBrowser)
    request = OpenSession(url="https://allticket.com/event")
    try:
        first = await service.create(request)
        if close_reason == "manual_browser_close":
            await service.tasks[first["id"]]
            DelayedCleanupBrowser.instances[0].emit("browser_closed", {"reason": "browser_window_closed"})
        await asyncio.wait_for(cleanup_started.wait(), timeout=1)
        assert service.get(first["id"])["status"] in {"closed", "failed"}
        assert not DelayedCleanupBrowser.instances[0].closed
        with pytest.raises(HTTPException) as error:
            await service.create(request)
        assert error.value.status_code == 409
        with pytest.raises(HTTPException) as clear_error:
            await service.clear_profile("allticket")
        assert clear_error.value.status_code == 409
        assert len(DelayedCleanupBrowser.instances) == 1

        allow_cleanup.set()
        await service._dispose(first["id"])
        second = await service.create(request)
        await service.tasks[second["id"]]
        assert service.get(second["id"])["status"] == "active"
        assert DelayedCleanupBrowser.instances[0].closed
    finally:
        allow_cleanup.set()
        await service.shutdown()
        repository.close()


def test_factory_failure_is_sanitized_and_does_not_leave_opening_session(tmp_path):
    attempts = 0

    def factory(settings, emit, *, platform="allticket"):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("private-factory-token")
        return FakeBrowser(settings, emit, platform=platform)

    with TestClient(create_app(Settings(data_dir=tmp_path, headless=True), factory), base_url="http://localhost:8000") as client:
        first = client.post("/api/research/sessions", json={"url": "https://allticket.com/event"})
        assert first.status_code == 201
        assert first.json()["status"] == "failed"
        exported = client.get(f"/api/research/sessions/{first.json()['id']}/export")
        assert "private-factory-token" not in exported.text
        next_id = opened(client)
        assert client.get(f"/api/research/sessions/{next_id}").json()["status"] == "active"


def test_profile_api_reports_unverified_data_and_clears_only_when_idle(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path, headless=True, persistent_browser_session=True)
    with TestClient(create_app(settings, FakeBrowser), base_url="http://localhost:8000") as client:
        path = "/api/browser-profiles/allticket"
        empty = client.get(path).json()
        assert empty == {
            "platform": "allticket", "persistence_enabled": True,
            "saved_data_present": False, "login_status": "unverified",
            "browser_in_use": False, "can_clear": True,
        }
        directory = client.app.state.research.profiles.path("allticket", create=True)
        (directory / "fixture.json").write_text('{"synthetic": "never-export-this"}')
        assert client.get(path).json()["saved_data_present"] is True
        assert "never-export-this" not in client.get(path).text
        assert str(tmp_path) not in client.get(path).text
        session_id = opened(client)
        assert client.get(path).json()["browser_in_use"] is True
        assert client.get(path).json()["can_clear"] is False
        assert client.post(path + "/clear").status_code == 409
        assert directory.exists()
        assert "never-export-this" not in client.get(f"/api/research/sessions/{session_id}/export").text
        assert client.post(f"/api/research/sessions/{session_id}/close").status_code == 200
        cleared = client.post(path + "/clear")
        assert cleared.status_code == 200
        assert cleared.json()["saved_data_present"] is False
        assert cleared.json()["login_status"] == "unverified"
        assert not directory.exists()


def test_profile_api_enforces_origin_host_platform_and_external_lease(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path, headless=True)
    with TestClient(create_app(settings, FakeBrowser), base_url="http://localhost:8000") as client:
        path = "/api/browser-profiles/ttm"
        assert client.get(path).json()["persistence_enabled"] is False
        assert client.get(path, headers={"Host": "evil.test"}).status_code == 400
        assert client.get(path, headers={"Origin": "https://evil.test"}).status_code == 403
        assert client.post(path + "/clear", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403
        invalid = client.post("/api/browser-profiles/private-invalid-platform/clear")
        assert invalid.status_code == 422
        assert "private-invalid-platform" not in invalid.text
        lease = client.app.state.research.profiles.acquire("ttm")
        try:
            assert client.get(path).json()["browser_in_use"] is True
            assert client.post(path + "/clear").status_code == 409
        finally:
            lease.release()
        assert client.post(path + "/clear").status_code == 200


def test_research_factory_receives_platform_for_profile_isolation(client):
    response = client.post("/api/research/sessions", json={
        "platform": "ttm", "url": "https://www.thaiticketmajor.com/concert/demo.html"
    })
    assert response.status_code == 201
    assert FakeBrowser.instances[-1].platform == "ttm"
