from backend.adapters.allticket import AllTicketAdapter
from backend.adapters.ttm import TTMAdapter

ADAPTERS = {adapter.id: adapter for adapter in (AllTicketAdapter(), TTMAdapter())}
