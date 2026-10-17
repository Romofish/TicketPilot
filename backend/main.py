from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.adapters import ADAPTERS
from backend.models.research import Marker, OpenSession
from backend.services.browser import BrowserObserver
from backend.services.research import ResearchService
from backend.settings import Settings
from backend.storage.repository import Repository

LOCAL_ORIGINS = {
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8000", "http://127.0.0.1:8000",
}


def create_app(settings: Settings | None = None, browser_factory: Callable = BrowserObserver) -> FastAPI:
    configuration = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        repository = Repository(configuration.data_dir)
        service = ResearchService(configuration, repository, browser_factory)
        application.state.research = service
        try:
            yield
        finally:
            await service.shutdown()
            repository.close()

    application = FastAPI(title="TicketPilot", version="0.1.0", lifespan=lifespan)
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "::1"])
    application.add_middleware(
        CORSMiddleware, allow_origins=sorted(LOCAL_ORIGINS), allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.middleware("http")
    async def check_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        cross_site = request.headers.get("sec-fetch-site") == "cross-site"
        if (origin and origin not in LOCAL_ORIGINS) or (
            cross_site and request.method not in {"GET", "HEAD", "OPTIONS"}
        ):
            return JSONResponse(status_code=403, content={"detail": "仅允许本机 TicketPilot 页面访问。"})
        return await call_next(request)

    @application.exception_handler(RequestValidationError)
    async def safe_validation_error(_request: Request, exception: RequestValidationError):
        # FastAPI's default validation response reflects submitted URLs and credentials.
        return JSONResponse(status_code=422, content={
            "detail": [{"type": error["type"], "msg": "输入格式不正确。"}
                       for error in exception.errors()]
        })

    @application.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "TicketPilot"}

    @application.get("/api/config")
    async def config() -> dict:
        return {
            "platforms": [{"id": adapter.id, "label": adapter.label} for adapter in ADAPTERS.values()],
            "browser_mode": "headless" if configuration.headless else "headed",
            "display_available": configuration.display_available,
            "max_active_sessions": 1,
            "capture_cooldown_seconds": configuration.capture_cooldown_seconds,
            "persistent_browser_session": configuration.persistent_browser_session,
        }

    def service() -> ResearchService:
        return application.state.research

    @application.get("/api/browser-profiles/{platform}")
    async def browser_profile(platform: Literal["allticket", "ttm"]) -> dict:
        return service().profile_status(platform)

    @application.post("/api/browser-profiles/{platform}/clear")
    async def clear_browser_profile(platform: Literal["allticket", "ttm"]) -> dict:
        return await service().clear_profile(platform)

    @application.get("/api/research/sessions")
    async def sessions() -> dict:
        return {"sessions": service().repository.list()}

    @application.post("/api/research/sessions", status_code=201)
    async def open_session(body: OpenSession) -> dict:
        return await service().create(body)

    @application.get("/api/research/sessions/{session_id}")
    async def session(session_id: str) -> dict:
        return service().get(session_id)

    @application.post("/api/research/sessions/{session_id}/capture", status_code=201)
    async def capture(session_id: str) -> dict:
        return await service().capture(session_id)

    @application.post("/api/research/sessions/{session_id}/markers", status_code=201)
    async def marker(session_id: str, body: Marker) -> dict:
        return service().marker(session_id, body.label)

    @application.post("/api/research/sessions/{session_id}/close")
    async def close(session_id: str) -> dict:
        return await service().close(session_id)

    @application.get("/api/research/sessions/{session_id}/events")
    async def events(session_id: str) -> dict:
        service().get(session_id)
        return {"events": service().repository.events(session_id)}

    @application.get("/api/research/sessions/{session_id}/export")
    async def export(session_id: str) -> dict:
        return {"schema_version": 1, "session": service().get(session_id),
                "events": service().repository.events(session_id)}

    return application


app = create_app()
