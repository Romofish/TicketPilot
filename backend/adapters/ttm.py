from backend.adapters.base import PlatformAdapter


class TTMAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            id="ttm", label="ThaiTicketMajor", hosts=frozenset(
                {"thaiticketmajor.com", "www.thaiticketmajor.com"}
            )
        )
