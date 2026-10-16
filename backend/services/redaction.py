"""Allow minimal diagnostic data; never persist browser text or URL paths."""

import re
from urllib.parse import urlsplit

_SECRET_KEYS = re.compile(
    r"password|passwd|cookie|token|secret|authorization|payment|credit|email|phone",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}")
_CREDENTIAL = re.compile(
    r"\b(?:bearer\s+\S+|(?:token|password|secret|cookie|authorization)\s*[:=]\s*\S+)",
    re.IGNORECASE,
)
_LONG_TOKEN = re.compile(r"\b[A-Za-z0-9_-]{24,}\b")
_PHONE = re.compile(r"(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)")
_URL = re.compile(r"https?://[^\s<>\"']+")
_SAFE_LABELS = frozenset({
    "user_reported_observation_only", "generic_unverified_heuristic",
    "page_changed_during_observation",
})


def sanitized_url(value: str) -> str:
    """Retain only origin; arbitrary paths can contain session or account tokens."""
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return "[redacted-url]"
        host = parsed.hostname.lower()
        # Only public platform origins belong in saved browser observations.
        if host not in {
            "allticket.com", "www.allticket.com", "thaiticketmajor.com",
            "www.thaiticketmajor.com",
        }:
            return "[external-origin]"
        path = "/[redacted-path]" if parsed.path not in {"", "/"} else "/"
        return f"{parsed.scheme}://{host}{path}"
    except (ValueError, TypeError):
        return "[redacted-url]"


def redact_text(value: str) -> str:
    if value in _SAFE_LABELS:
        return value
    value = _URL.sub(lambda match: sanitized_url(match.group()), value)
    for expression in (_EMAIL, _CREDENTIAL, _LONG_TOKEN, _PHONE):
        value = expression.sub("[redacted]", value)
    return "".join(c for c in value[:200] if c.isprintable())


def redact(value: object) -> object:
    if isinstance(value, dict):
        return {
            str(key): "[redacted]" if _SECRET_KEYS.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, (bool, int, float)) or value is None:
        return value
    return "[redacted]"
