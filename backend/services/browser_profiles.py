"""Private, application-owned browser data; never read or export login values."""

import os
import shutil
import stat
from pathlib import Path

from backend.settings import Settings

PROFILE_DIRECTORY = ".ticketpilot-browser-profiles"
PLATFORMS = frozenset({"allticket", "ttm"})


class BrowserProfileError(RuntimeError):
    category = "profile_storage_unavailable"

    def __init__(self):
        super().__init__(self.category)


class BrowserProfileBusy(BrowserProfileError):
    category = "profile_in_use"


def _directory(path: Path, *, create: bool = False, private: bool = False) -> bool:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        if not create:
            return False
        path.mkdir(mode=0o700)
        metadata = path.lstat()
    if not stat.S_ISDIR(metadata.st_mode) or path.is_junction():
        raise BrowserProfileError()
    if private and os.name == "posix":
        if metadata.st_uid != os.getuid():
            raise BrowserProfileError()
        if create:
            path.chmod(0o700)
    return True


class ProfileLease:
    def __init__(self, descriptor: int):
        self.descriptor: int | None = descriptor

    def release(self) -> None:
        if self.descriptor is not None:
            os.close(self.descriptor)
            self.descriptor = None


class BrowserProfiles:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.data_dir.absolute() / PROFILE_DIRECTORY

    def _root_exists(self, *, create: bool = False) -> bool:
        # Reject symlinks in every ancestor, including a configured DATA_DIR.
        for path in reversed(self.root.parent.parents):
            _directory(path)
        if not _directory(self.root.parent, create=create):
            return False
        return _directory(self.root, create=create, private=True)

    def path(self, platform: str, *, create: bool = False) -> Path:
        if platform not in PLATFORMS:
            raise BrowserProfileError()
        if self._root_exists(create=create):
            _directory(self.root / platform, create=create, private=True)
        return self.root / platform

    def acquire(self, platform: str, *, create: bool = True) -> ProfileLease | None:
        self.path(platform)
        if not self._root_exists(create=create):
            return None
        lock_path = self.root / f".{platform}.lock"
        try:
            if lock_path.is_symlink():
                raise BrowserProfileError()
            flags = os.O_RDWR | (os.O_CREAT if create else 0) | getattr(os, "O_NOFOLLOW", 0)
            descriptor = os.open(lock_path, flags, 0o600)
        except FileNotFoundError:
            if not create:
                return None
            raise
        lease = ProfileLease(descriptor)
        try:
            metadata = os.fstat(descriptor)
            if not stat.S_ISREG(metadata.st_mode):
                raise BrowserProfileError()
            if os.name == "posix":
                import fcntl

                if metadata.st_uid != os.getuid():
                    raise BrowserProfileError()
                os.fchmod(descriptor, 0o600)
                try:
                    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    raise BrowserProfileBusy() from None
            elif os.name == "nt":
                import msvcrt

                if metadata.st_size == 0:
                    os.write(descriptor, b"0")
                    os.lseek(descriptor, 0, os.SEEK_SET)
                try:
                    msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
                except OSError:
                    raise BrowserProfileBusy() from None
            else:
                raise BrowserProfileError()
            return lease
        except BaseException:
            lease.release()
            raise

    def status(self, platform: str, *, browser_in_use: bool = False) -> dict:
        path = self.path(platform)
        present = path.exists() and next(path.iterdir(), None) is not None
        lease = None
        try:
            lease = self.acquire(platform, create=False)
        except BrowserProfileBusy:
            browser_in_use = True
        finally:
            if lease:
                lease.release()
        return {
            "platform": platform,
            "persistence_enabled": self.settings.persistent_browser_session,
            "saved_data_present": present,
            "login_status": "unverified",
            "browser_in_use": browser_in_use,
            "can_clear": not browser_in_use,
        }

    def clear(self, platform: str) -> None:
        lease = self.acquire(platform)
        try:
            path = self.path(platform)
            if path.exists():
                shutil.rmtree(path)
        finally:
            if lease:
                lease.release()
