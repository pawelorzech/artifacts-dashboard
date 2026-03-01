import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from httpx import HTTPStatusError
from pydantic import BaseModel, Field

from app.database import async_session_factory
from app.services.artifacts_client import ArtifactsClient
from app.services.bank_service import BankService
from app.services.game_data_cache import GameDataCacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["bank"])


def _get_client(request: Request) -> ArtifactsClient:
    return request.app.state.artifacts_client


def _get_cache_service(request: Request) -> GameDataCacheService:
    return request.app.state.cache_service


# ---------------------------------------------------------------------------
# Request schemas for manual actions
# ---------------------------------------------------------------------------


class ManualActionRequest(BaseModel):
    """Request body for manual character actions."""

    action: str = Field(
        ...,
        description="Action to perform: 'move', 'fight', 'gather', 'rest'",
    )
    params: dict = Field(
        default_factory=dict,
        description="Action parameters (e.g. {x, y} for move)",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/bank")
async def get_bank(request: Request) -> dict[str, Any]:
    """Return bank details with enriched item data from game cache."""
    client = _get_client(request)
    cache_service = _get_cache_service(request)
    bank_service = BankService()

    try:
        # Try to get items cache for enrichment
        items_cache = None
        try:
            async with async_session_factory() as db:
                items_cache = await cache_service.get_items(db)
        except Exception:
            logger.warning("Failed to load items cache for bank enrichment")

        result = await bank_service.get_contents(client, items_cache)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return result


@router.get("/bank/summary")
async def get_bank_summary(request: Request) -> dict[str, Any]:
    """Return a summary of bank contents: gold, item count, slots."""
    client = _get_client(request)
    bank_service = BankService()

    try:
        return await bank_service.get_summary(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc


@router.post("/characters/{name}/action")
async def manual_action(
    name: str,
    body: ManualActionRequest,
    request: Request,
) -> dict[str, Any]:
    """Execute a manual action on a character.

    Supported actions:
    - **move**: Move to coordinates. Params: {"x": int, "y": int}
    - **fight**: Fight the monster at the current tile. No params.
    - **gather**: Gather the resource at the current tile. No params.
    - **rest**: Rest to recover HP. No params.
    """
    client = _get_client(request)

    try:
        match body.action:
            case "move":
                x = body.params.get("x")
                y = body.params.get("y")
                if x is None or y is None:
                    raise HTTPException(
                        status_code=400,
                        detail="Move action requires 'x' and 'y' in params",
                    )
                result = await client.move(name, int(x), int(y))
            case "fight":
                result = await client.fight(name)
            case "gather":
                result = await client.gather(name)
            case "rest":
                result = await client.rest(name)
            case _:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown action: {body.action!r}. Supported: move, fight, gather, rest",
                )
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"action": body.action, "character": name, "result": result}
