from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from backend.services.redaction import redact, redact_text, sanitized_url


def now() -> str:
    return datetime.now(UTC).isoformat()


class Repository:
    def __init__(self, data_dir: Path):
        data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = data_dir / "research.sqlite3"
        self.db = sqlite3.connect(path, check_same_thread=False)
        path.chmod(0o600)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, platform TEXT NOT NULL, url TEXT NOT NULL,
                event_name TEXT NOT NULL, status TEXT NOT NULL,
                started_at TEXT NOT NULL, ended_at TEXT, error TEXT
            );
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL,
                created_at TEXT NOT NULL, data TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            CREATE INDEX IF NOT EXISTS events_session ON events(session_id);
        """)
        self.db.execute(
            "UPDATE sessions SET status='closed', ended_at=?, error=? "
            "WHERE status IN ('active', 'opening')",
            (now(), "服务已重启；原浏览器会话未恢复，请新建会话。"),
        )
        self.db.commit()

    def create_session(self, platform: str, url: str, event_name: str) -> dict:
        session = {
            "id": str(uuid4()), "platform": platform, "url": sanitized_url(url),
            "event_name": redact_text(event_name), "status": "opening", "started_at": now(),
            "ended_at": None, "error": None,
        }
        self.db.execute(
            "INSERT INTO sessions VALUES (:id,:platform,:url,:event_name,:status,:started_at,:ended_at,:error)",
            session,
        )
        self.db.commit()
        return session

    def get(self, session_id: str) -> dict | None:
        row = self.db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        return dict(row) if row else None

    def list(self) -> list[dict]:
        return [dict(row) for row in self.db.execute("SELECT * FROM sessions ORDER BY started_at DESC")]

    def update(self, session_id: str, status: str, error: str | None = None) -> dict:
        self.db.execute(
            "UPDATE sessions SET status=?,ended_at=?,error=? WHERE id=?",
            (status, now() if status in {"failed", "closed"} else None,
             redact_text(error) if error else None, session_id),
        )
        self.db.commit()
        return self.get(session_id)

    def add_event(self, session_id: str, kind: str, data: dict) -> dict:
        event = {"id": str(uuid4()), "session_id": session_id, "kind": kind,
                 "created_at": now(), "data": redact(data)}
        self.db.execute(
            "INSERT INTO events VALUES (?,?,?,?,?)",
            (event["id"], session_id, kind, event["created_at"], json.dumps(event["data"], ensure_ascii=False)),
        )
        self.db.commit()
        return event

    def events(self, session_id: str) -> list[dict]:
        return [
            {**dict(row), "data": json.loads(row["data"])}
            for row in self.db.execute(
                "SELECT * FROM events WHERE session_id=? ORDER BY rowid", (session_id,)
            )
        ]

    def close(self) -> None:
        self.db.close()
