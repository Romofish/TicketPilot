from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class PlatformAdapter:
    id: str
    label: str
    hosts: frozenset[str]

    def validate_url(self, value: str) -> str:
        try:
            parsed = urlsplit(value)
            valid = (
                parsed.scheme == "https"
                and parsed.hostname in self.hosts
                and parsed.username is None
                and parsed.password is None
                and parsed.port in {None, 443}
                and "\\" not in value
                and not any(character.isspace() or ord(character) < 32 for character in value)
            )
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("请输入所选平台官方域名的 HTTPS 活动 URL；不接受账号信息或自定义端口。")
        return value
