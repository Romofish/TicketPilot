from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings


def test_health(tmp_path) -> None:
    with TestClient(create_app(Settings(data_dir=tmp_path)), base_url="http://localhost:8000") as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "TicketPilot"}
