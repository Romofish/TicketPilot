from backend.adapters.base import PlatformAdapter


class AllTicketAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            id="allticket", label="ALL TICKET", hosts=frozenset({"allticket.com", "www.allticket.com"})
        )
