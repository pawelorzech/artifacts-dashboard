import asyncio
import logging
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game_cache import GameDataCache
from app.schemas.game import ItemSchema, MapSchema, MonsterSchema, ResourceSchema
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)

# In-memory cache TTL in seconds (30 minutes)
CACHE_TTL: float = 30 * 60


class _MemoryCacheEntry:
    __slots__ = ("data", "fetched_at")

    def __init__(self, data: Any, fetched_at: float) -> None:
        self.data = data
        self.fetched_at = fetched_at

    def is_expired(self) -> bool:
        return (time.monotonic() - self.fetched_at) > CACHE_TTL


class GameDataCacheService:
    """Manages a two-layer cache (in-memory + database) for static game data.

    The database layer acts as a persistent warm cache so that a fresh restart
    does not require a full re-fetch from the Artifacts API.  The in-memory
    layer avoids repeated database round-trips for hot reads.
    """

    def __init__(self) -> None:
        self._memory: dict[str, _MemoryCacheEntry] = {}
        self._refresh_task: asyncio.Task[None] | None = None

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    async def get_items(self, db: AsyncSession) -> list[ItemSchema]:
        raw = await self._get_from_cache(db, "items")
        if raw is None:
            return []
        return [ItemSchema.model_validate(i) for i in raw]

    async def get_monsters(self, db: AsyncSession) -> list[MonsterSchema]:
        raw = await self._get_from_cache(db, "monsters")
        if raw is None:
            return []
        return [MonsterSchema.model_validate(m) for m in raw]

    async def get_resources(self, db: AsyncSession) -> list[ResourceSchema]:
        raw = await self._get_from_cache(db, "resources")
        if raw is None:
            return []
        return [ResourceSchema.model_validate(r) for r in raw]

    async def get_maps(self, db: AsyncSession) -> list[MapSchema]:
        raw = await self._get_from_cache(db, "maps")
        if raw is None:
            return []
        return [MapSchema.model_validate(m) for m in raw]

    # ------------------------------------------------------------------
    # Full refresh
    # ------------------------------------------------------------------

    async def refresh_all(self, db: AsyncSession, client: ArtifactsClient) -> None:
        """Fetch all game data from the API and persist into the cache table."""
        logger.info("Starting full game-data cache refresh")

        fetchers: dict[str, Any] = {
            "items": client.get_all_items,
            "monsters": client.get_all_monsters,
            "resources": client.get_all_resources,
            "maps": client.get_all_maps,
        }

        for data_type, fetcher in fetchers.items():
            try:
                results = await fetcher()
                serialized = [r.model_dump(mode="json") for r in results]
                await self._upsert_cache(db, data_type, serialized)
                self._memory[data_type] = _MemoryCacheEntry(
                    data=serialized,
                    fetched_at=time.monotonic(),
                )
                logger.info(
                    "Cached %d entries for %s",
                    len(serialized),
                    data_type,
                )
            except Exception:
                logger.exception("Failed to refresh cache for %s", data_type)

        await db.commit()
        logger.info("Game-data cache refresh complete")

    # ------------------------------------------------------------------
    # Background periodic refresh
    # ------------------------------------------------------------------

    def start_background_refresh(
        self,
        db_factory: Any,
        client: ArtifactsClient,
        interval_seconds: float = CACHE_TTL,
    ) -> asyncio.Task[None]:
        """Spawn a background task that refreshes the cache periodically."""

        async def _loop() -> None:
            while True:
                try:
                    async with db_factory() as db:
                        await self.refresh_all(db, client)
                except asyncio.CancelledError:
                    logger.info("Cache refresh background task cancelled")
                    return
                except Exception:
                    logger.exception("Unhandled error during background cache refresh")
                await asyncio.sleep(interval_seconds)

        self._refresh_task = asyncio.create_task(_loop())
        return self._refresh_task

    def stop_background_refresh(self) -> None:
        if self._refresh_task is not None and not self._refresh_task.done():
            self._refresh_task.cancel()

    # ------------------------------------------------------------------
    # Internal cache access
    # ------------------------------------------------------------------

    async def _get_from_cache(
        self,
        db: AsyncSession,
        data_type: str,
    ) -> list[dict[str, Any]] | None:
        # 1. Try in-memory cache
        entry = self._memory.get(data_type)
        if entry is not None and not entry.is_expired():
            return entry.data

        # 2. Fall back to database
        stmt = select(GameDataCache).where(GameDataCache.data_type == data_type)
        result = await db.execute(stmt)
        row = result.scalar_one_or_none()

        if row is None:
            return None

        # Populate in-memory cache from DB
        self._memory[data_type] = _MemoryCacheEntry(
            data=row.data,
            fetched_at=time.monotonic(),
        )
        return row.data

    async def _upsert_cache(
        self,
        db: AsyncSession,
        data_type: str,
        data: list[dict[str, Any]],
    ) -> None:
        stmt = select(GameDataCache).where(GameDataCache.data_type == data_type)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            existing.data = data
        else:
            db.add(GameDataCache(data_type=data_type, data=data))
