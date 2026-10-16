"""Build the reproducible, source-only TicketPilot preview archive with stdlib."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path

RELEASE_VERSION = "v0.1.0-m2-preview"
ARCHIVE_ROOT = f"TicketPilot-{RELEASE_VERSION}"
SOURCE_DIRECTORIES = ("backend", "frontend", "tests", "scripts", "docs")
ROOT_FILES = (
    ".env.example",
    ".gitignore",
    ".npmrc",
    ".nvmrc",
    ".python-version",
    "AGENTS.md",
    "README.md",
    "package.json",
    "package-lock.json",
    "pyproject.toml",
    "uv.lock",
)
SOURCE_EXTENSIONS = {
    ".css", ".html", ".js", ".json", ".jsx", ".lock", ".md", ".mjs",
    ".py", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
}
EXCLUDED_NAMES = {
    ".cache", ".git", ".pytest_cache", ".ruff_cache", ".venv", "__pycache__",
    "coverage", "data", "dist", "node_modules", "playwright-report", "test-results",
}
SENSITIVE_NAME = re.compile(
    r"(?:^|[._-])(?:secrets?|credentials?|tokens?|private[._-]?keys?)(?:[._-]|$)",
    re.IGNORECASE,
)
KNOWN_CREDENTIAL = re.compile(
    r"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----"
    r"|\bgh[pousr]_[A-Za-z0-9]{36,}\b"
    r"|\bgithub_pat_[A-Za-z0-9_]{40,}\b"
    r"|\bAKIA[0-9A-Z]{16}\b"
    r"|\bsk-[A-Za-z0-9_-]{32,}\b"
)
DEFAULT_SOURCE_DATE_EPOCH = 315532800  # ZIP's earliest timestamp: 1980-01-01 UTC.


class ReleaseError(ValueError):
    """A source tree or release configuration cannot be safely packaged."""


def archive_timestamp() -> tuple[int, int, int, int, int, int]:
    """Use SOURCE_DATE_EPOCH or a fixed UTC timestamp, independent of file mtimes."""
    value = os.environ.get("SOURCE_DATE_EPOCH", str(DEFAULT_SOURCE_DATE_EPOCH))
    try:
        epoch = int(value)
        stamp = datetime.fromtimestamp(epoch, UTC)
    except (ValueError, OverflowError, OSError) as exc:
        raise ReleaseError("SOURCE_DATE_EPOCH must be a valid Unix timestamp.") from exc
    if not 1980 <= stamp.year <= 2107:
        raise ReleaseError("SOURCE_DATE_EPOCH must be within ZIP's years 1980 through 2107.")
    return (stamp.year, stamp.month, stamp.day, stamp.hour, stamp.minute, stamp.second // 2 * 2)


def _require_regular_file(path: Path, root: Path) -> None:
    if path.is_symlink():
        raise ReleaseError(f"Source symlink is not allowed: {path.relative_to(root)}")
    if not path.is_file() or not stat.S_ISREG(path.stat().st_mode):
        raise ReleaseError(f"Expected a regular source file: {path.relative_to(root)}")


def _excluded(path: Path) -> bool:
    name = path.name.lower()
    return (
        name in EXCLUDED_NAMES
        or name.startswith(".")
        or bool(SENSITIVE_NAME.search(name))
    )


def collect_sources(root: Path) -> list[Path]:
    """Select explicit source roots and text extensions; never follow symlinks."""
    selected = []
    for filename in ROOT_FILES:
        path = root / filename
        _require_regular_file(path, root)
        selected.append(path)

    def walk(directory: Path) -> None:
        if directory.is_symlink():
            raise ReleaseError(f"Source symlink is not allowed: {directory.relative_to(root)}")
        if not directory.is_dir():
            raise ReleaseError(f"Expected a source directory: {directory.relative_to(root)}")
        for path in sorted(directory.iterdir(), key=lambda item: item.name):
            if _excluded(path):
                continue
            if path.is_symlink():
                raise ReleaseError(f"Source symlink is not allowed: {path.relative_to(root)}")
            if path.is_dir():
                walk(path)
            elif path.suffix.lower() in SOURCE_EXTENSIONS:
                _require_regular_file(path, root)
                selected.append(path)

    for dirname in SOURCE_DIRECTORIES:
        walk(root / dirname)
    return sorted(selected, key=lambda path: path.relative_to(root).as_posix())


def _source_bytes(path: Path, root: Path) -> bytes:
    _require_regular_file(path, root)
    content = path.read_bytes()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ReleaseError(f"Source is not UTF-8 text: {path.relative_to(root)}") from exc
    if "\x00" in text:
        raise ReleaseError(f"Binary content is not allowed: {path.relative_to(root)}")
    if KNOWN_CREDENTIAL.search(text):
        raise ReleaseError(f"Potential credential in source: {path.relative_to(root)}")
    return content


def _safe_output_path(path: Path) -> None:
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ReleaseError(f"Unsafe release output path: {path.name}")


def build_release(root: Path) -> dict[str, str | int]:
    """Write dist/*.zip and SHA256SUMS; source and fixed metadata determine bytes."""
    if root.is_symlink():
        raise ReleaseError("Project root must not be a symlink.")
    root = root.resolve(strict=True)
    timestamp = archive_timestamp()
    sources = collect_sources(root)
    # Validate everything before touching an existing release.
    contents = [(path.relative_to(root).as_posix(), _source_bytes(path, root)) for path in sources]
    destination = root / "dist"
    if destination.is_symlink() or (destination.exists() and not destination.is_dir()):
        raise ReleaseError("dist must be a real directory, not a symlink or file.")
    destination.mkdir(exist_ok=True)
    archive_path = destination / f"{ARCHIVE_ROOT}-source.zip"
    checksums_path = destination / "SHA256SUMS"
    _safe_output_path(archive_path)
    _safe_output_path(checksums_path)

    temp_archive = None
    temp_checksums = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination, suffix=".zip.tmp", delete=False) as stream:
            temp_archive = Path(stream.name)
        # ZIP_STORED avoids compression-library differences between operating systems.
        with zipfile.ZipFile(temp_archive, "w", compression=zipfile.ZIP_STORED) as archive:
            for relative, content in contents:
                info = zipfile.ZipInfo(f"{ARCHIVE_ROOT}/{relative}", date_time=timestamp)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(info, content, compress_type=zipfile.ZIP_STORED)
        archive_bytes = temp_archive.read_bytes()
        digest = hashlib.sha256(archive_bytes).hexdigest()
        with tempfile.NamedTemporaryFile(dir=destination, suffix=".sha.tmp", delete=False) as stream:
            temp_checksums = Path(stream.name)
            stream.write(f"{digest}  {archive_path.name}\n".encode("ascii"))
        temp_archive.replace(archive_path)
        temp_checksums.replace(checksums_path)
    finally:
        if temp_archive is not None:
            temp_archive.unlink(missing_ok=True)
        if temp_checksums is not None:
            temp_checksums.unlink(missing_ok=True)

    return {
        "version": RELEASE_VERSION,
        "archive": str(archive_path),
        "sha256": digest,
        "archive_bytes": len(archive_bytes),
        "source_bytes": sum(len(content) for _, content in contents),
        "files": len(contents),
        "checksums": str(checksums_path),
    }


def main() -> int:
    try:
        result = build_release(Path(__file__).absolute().parent.parent)
    except (ReleaseError, OSError, zipfile.BadZipFile) as exc:
        print(f"Release packaging failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
