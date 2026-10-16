import json

from backend.services.redaction import redact, sanitized_url
from backend.storage.repository import Repository


def test_url_discards_path_query_fragment_and_credentials():
    result = sanitized_url("https://name:secret@www.allticket.com/user/sensitive-session?token=abc#password")
    assert result == "https://www.allticket.com/[redacted-path]"
    assert sanitized_url("https://private.example.com/account") == "[external-origin]"


def test_nested_credentials_and_obvious_personal_data_are_redacted():
    data = redact({
        "cookie": "session-secret", "nested": [{"authorization": "Bearer mysecret"}],
        "description": "person@example.com +66812345678 password=abc Bearer secret-value",
    })
    serialized = json.dumps(data)
    for secret in ["session-secret", "mysecret", "person@example.com", "66812345678", "abc", "secret-value"]:
        assert secret not in serialized


def test_persistence_redacts_and_recovers_stale_sessions(tmp_path):
    repo = Repository(tmp_path)
    session = repo.create_session("allticket", "https://allticket.com/private-token?token=secret", "person@example.com")
    repo.add_event(session["id"], "diagnostic", {"token": "secret", "url": "https://allticket.com/secret"})
    repo.close()
    repo = Repository(tmp_path)
    assert repo.get(session["id"])["status"] == "closed"
    assert repo.get(session["id"])["ended_at"]
    assert "secret" not in json.dumps(repo.events(session["id"]))
    assert "person@example.com" not in repo.get(session["id"])["event_name"]
    repo.close()
