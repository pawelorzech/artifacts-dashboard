import logging

from fastapi import APIRouter, HTTPException, Request
from httpx import HTTPStatusError

from app.api.deps import get_user_client
from app.schemas.game import DashboardData
from app.services.character_service import CharacterService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])


def _get_service(request: Request) -> CharacterService:
    return request.app.state.character_service


@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(request: Request) -> DashboardData:
    """Return aggregated dashboard data: all characters + server status."""
    client = get_user_client(request)
    service = _get_service(request)

    try:
        characters = await service.get_all(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    # Server status could be extended later (e.g., ping, event info)
    server_status: dict | None = None
    try:
        events = await client.get_events()
        server_status = {"events": events}
    except Exception:
        logger.warning("Failed to fetch server events for dashboard", exc_info=True)

    return DashboardData(
        characters=characters,
        server_status=server_status,
    )
