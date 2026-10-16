import pytest

from backend.adapters import ADAPTERS


@pytest.mark.parametrize("platform,url", [
    ("allticket", "https://www.allticket.com/concert/example?ref=sample#details"),
    ("ttm", "https://www.thaiticketmajor.com/concert/example.html"),
])
def test_official_url_accepted(platform, url):
    assert ADAPTERS[platform].validate_url(url) == url


@pytest.mark.parametrize("url", [
    "http://www.allticket.com/event", "https://allticket.com.evil.test/event",
    "https://evil.allticket.com/event", "https://127.0.0.1/event", "https://[::1]/event",
    "https://user:password@allticket.com/event", "https://allticket.com:8000/event",
    "https://allticket.com\\@evil.test/event", "https://allticket.com/event\n",
    "file:///etc/passwd", "javascript:alert(1)", "https://thaiticketmajor.com/event",
    "https://allticket.com:bad/event", "https://allticket.com./event",
])
def test_unsafe_or_unverified_host_rejected(url):
    with pytest.raises(ValueError):
        ADAPTERS["allticket"].validate_url(url)
