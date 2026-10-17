import os
import stat
import subprocess
import sys
from pathlib import Path

import pytest

from backend.services.browser_profiles import (
    PROFILE_DIRECTORY,
    BrowserProfileBusy,
    BrowserProfileError,
    BrowserProfiles,
)
from backend.settings import Settings


def profiles_at(path):
    return BrowserProfiles(Settings(
        _env_file=None, data_dir=path, persistent_browser_session=True
    ))


def test_profile_status_is_unverified_and_platforms_clear_independently(tmp_path):
    profiles = profiles_at(tmp_path)
    assert profiles.status("allticket") == {
        "platform": "allticket", "persistence_enabled": True,
        "saved_data_present": False, "login_status": "unverified",
        "browser_in_use": False, "can_clear": True,
    }
    assert not profiles.root.exists()
    for platform in ("allticket", "ttm"):
        path = profiles.path(platform, create=True)
        (path / "synthetic-session.json").write_text("synthetic private data")
        assert profiles.status(platform)["saved_data_present"]
        assert profiles.status(platform)["login_status"] == "unverified"
    assert profiles.path("allticket") != profiles.path("ttm")

    profiles.clear("allticket")

    assert not profiles.status("allticket")["saved_data_present"]
    assert profiles.status("ttm")["saved_data_present"]
    assert profiles.status("ttm", browser_in_use=True)["can_clear"] is False


@pytest.mark.parametrize("platform", ["../private-path", "ALLTICKET", "", "/tmp/private-path"])
def test_profile_platform_rejection_does_not_expose_paths(tmp_path, platform):
    profiles = profiles_at(tmp_path)
    with pytest.raises(BrowserProfileError) as error:
        profiles.acquire(platform)
    assert str(error.value) == "profile_storage_unavailable"
    assert not profiles.root.exists()


@pytest.mark.parametrize("component", [
    "ancestor", "data_dir", "profile_root", "platform", "dangling_platform",
])
def test_profile_paths_reject_symlink_components(tmp_path, component):
    target = tmp_path / "private-external-target"
    target.mkdir()
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    if component == "ancestor":
        link = tmp_path / "linked-parent"
        data_dir = link / "data"
    elif component == "data_dir":
        data_dir.rmdir()
        link = data_dir
    elif component == "profile_root":
        link = data_dir / PROFILE_DIRECTORY
    else:
        (data_dir / PROFILE_DIRECTORY).mkdir()
        link = data_dir / PROFILE_DIRECTORY / "allticket"
        if component == "dangling_platform":
            target.rmdir()
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("Creating symlinks is unavailable on this platform")

    profiles = profiles_at(data_dir)
    for operation in (
        lambda: profiles.path("allticket", create=True),
        lambda: profiles.status("allticket"),
        lambda: profiles.clear("allticket"),
    ):
        with pytest.raises(BrowserProfileError) as error:
            operation()
        assert str(error.value) == "profile_storage_unavailable"
    assert link.is_symlink()
    if target.exists():
        assert list(target.iterdir()) == []


@pytest.mark.skipif(os.name != "posix", reason="POSIX directory permission semantics")
def test_profile_directories_and_lock_are_private(tmp_path):
    profiles = profiles_at(tmp_path)
    path = profiles.path("allticket", create=True)
    profiles.root.chmod(0o755)
    path.chmod(0o755)

    lease = profiles.acquire("allticket")
    try:
        profiles.path("allticket", create=True)
        assert stat.S_IMODE(profiles.root.stat().st_mode) == 0o700
        assert stat.S_IMODE(path.stat().st_mode) == 0o700
        assert stat.S_IMODE((profiles.root / ".allticket.lock").stat().st_mode) == 0o600
    finally:
        lease.release()


def test_external_profile_lease_blocks_clear_until_released(tmp_path):
    profiles = profiles_at(tmp_path)
    path = profiles.path("allticket", create=True)
    marker = path / "synthetic-session.json"
    marker.write_text("synthetic private data")
    lease = profiles.acquire("allticket")
    try:
        other_manager = profiles_at(tmp_path)
        assert other_manager.status("allticket")["browser_in_use"] is True
        assert other_manager.status("allticket")["can_clear"] is False
        with pytest.raises(BrowserProfileBusy, match="^profile_in_use$"):
            other_manager.clear("allticket")
        child = subprocess.run(
            [sys.executable, "-c", """
import sys
from pathlib import Path
from backend.services.browser_profiles import BrowserProfileBusy, BrowserProfiles
from backend.settings import Settings
profiles = BrowserProfiles(Settings(_env_file=None, data_dir=Path(sys.argv[1])))
try:
    profiles.clear("allticket")
except BrowserProfileBusy:
    raise SystemExit(0)
raise SystemExit(1)
""", str(tmp_path)],
            capture_output=True, text=True, timeout=10,
            env={**os.environ, "PYTHONPATH": str(Path(__file__).resolve().parents[2])},
        )
        assert child.returncode == 0, child.stderr
        assert marker.exists()
    finally:
        lease.release()
    profiles.clear("allticket")
    assert not path.exists()
    assert profiles.status("allticket")["browser_in_use"] is False


def test_clear_does_not_follow_symlinks_inside_profile(tmp_path):
    profiles = profiles_at(tmp_path / "data")
    path = profiles.path("allticket", create=True)
    target = tmp_path / "outside-profile"
    target.mkdir()
    marker = target / "synthetic-private-data.json"
    marker.write_text("synthetic private data")
    try:
        (path / "linked-directory").symlink_to(target, target_is_directory=True)
        (path / "linked-file.json").symlink_to(marker)
    except OSError:
        pytest.skip("Creating symlinks is unavailable on this platform")

    profiles.clear("allticket")

    assert not path.exists()
    assert marker.read_text() == "synthetic private data"
