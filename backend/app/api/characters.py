from fastapi import APIRouter, HTTPException, Request
from httpx import HTTPStatusError

from app.api.deps import get_user_client
from app.schemas.game import CharacterSchema
from app.services.character_service import CharacterService

router = APIRouter(prefix="/api/characters", tags=["characters"])


def _get_service(request: Request) -> CharacterService:
    return request.app.state.character_service


@router.get("/", response_model=list[CharacterSchema])
async def list_characters(request: Request) -> list[CharacterSchema]:
    """Return all characters belonging to the authenticated account."""
    client = get_user_client(request)
    service = _get_service(request)
    try:
        return await service.get_all(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc


@router.get("/{name}", response_model=CharacterSchema)
async def get_character(name: str, request: Request) -> CharacterSchema:
    """Return a single character by name."""
    client = get_user_client(request)
    service = _get_service(request)
    try:
        return await service.get_one(client, name)
    except HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Character not found") from exc
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc
