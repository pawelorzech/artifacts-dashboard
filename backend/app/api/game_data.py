from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.game import ItemSchema, MapSchema, MonsterSchema, ResourceSchema
from app.services.game_data_cache import GameDataCacheService

router = APIRouter(prefix="/api/game", tags=["game-data"])


def _get_cache_service(request: Request) -> GameDataCacheService:
    return request.app.state.cache_service


@router.get("/items", response_model=list[ItemSchema])
async def list_items(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[ItemSchema]:
    """Return all items from the local cache."""
    service = _get_cache_service(request)
    return await service.get_items(db)


@router.get("/monsters", response_model=list[MonsterSchema])
async def list_monsters(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[MonsterSchema]:
    """Return all monsters from the local cache."""
    service = _get_cache_service(request)
    return await service.get_monsters(db)


@router.get("/resources", response_model=list[ResourceSchema])
async def list_resources(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[ResourceSchema]:
    """Return all resources from the local cache."""
    service = _get_cache_service(request)
    return await service.get_resources(db)


@router.get("/maps", response_model=list[MapSchema])
async def list_maps(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[MapSchema]:
    """Return all maps from the local cache."""
    service = _get_cache_service(request)
    return await service.get_maps(db)
