import os
import sys
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TICKETPILOT_", env_file=".env", extra="ignore"
    )

    data_dir: Path = Path("data")
    headless: bool = False
    browser_executable_path: str | None = None
    navigation_timeout_ms: int = Field(default=45000, ge=1000, le=120000)
    capture_cooldown_seconds: float = Field(default=3, ge=0, le=60)

    @field_validator("browser_executable_path", mode="before")
    @classmethod
    def empty_executable_uses_playwright_default(cls, value):
        return value or None

    @property
    def display_available(self) -> bool:
        return sys.platform in {"win32", "darwin"} or bool(
            os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
        )
