import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# ---- Sentry (conditional) ----
if settings.sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.2,
            send_default_pii=False,
        )
    except Exception:
        pass  # Sentry is optional; don't block startup
from app.database import async_session_factory, engine, Base
from app.services.artifacts_client import ArtifactsClient
from app.services.character_service import CharacterService
from app.services.game_data_cache import GameDataCacheService

# Import models so they are registered on Base.metadata
from app.models import game_cache as _game_cache_model  # noqa: F401
from app.models import character_snapshot as _snapshot_model  # noqa: F401
from app.models import automation as _automation_model  # noqa: F401
from app.models import workflow as _workflow_model  # noqa: F401
from app.models import price_history as _price_history_model  # noqa: F401
from app.models import event_log as _event_log_model  # noqa: F401
from app.models import app_error as _app_error_model  # noqa: F401
from app.models import pipeline as _pipeline_model  # noqa: F401

# Import routers
from app.api.characters import router as characters_router
from app.api.game_data import router as game_data_router
from app.api.dashboard import router as dashboard_router
from app.api.bank import router as bank_router
from app.api.automations import router as automations_router
from app.api.ws import router as ws_router
from app.api.exchange import router as exchange_router
from app.api.events import router as events_router
from app.api.logs import router as logs_router
from app.api.auth import router as auth_router
from app.api.workflows import router as workflows_router
from app.api.errors import router as errors_router
from app.api.pipelines import router as pipelines_router

# Automation engine
from app.engine.pathfinder import Pathfinder
from app.engine.manager import AutomationManager

# Error-handling middleware
from app.middleware.error_handler import ErrorHandlerMiddleware

# Exchange service
from app.services.exchange_service import ExchangeService

# WebSocket system
from app.websocket.event_bus import EventBus
from app.websocket.client import GameWebSocketClient
from app.websocket.handlers import GameEventHandler

logger = logging.getLogger(__name__)


class _JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


_handler = logging.StreamHandler(sys.stdout)
if settings.environment != "development":
    _handler.setFormatter(_JSONFormatter())
else:
    _handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

logging.basicConfig(level=logging.INFO, handlers=[_handler])


async def _snapshot_loop(
    db_factory: async_session_factory.__class__,
    client: ArtifactsClient,
    character_service: CharacterService,
    interval: float = 60.0,
) -> None:
    """Periodically save character snapshots."""
    while True:
        try:
            async with db_factory() as db:
                await character_service.take_snapshot(db, client)
        except asyncio.CancelledError:
            logger.info("Character snapshot loop cancelled")
            return
        except Exception:
            logger.exception("Error taking character snapshot")
        await asyncio.sleep(interval)


async def _load_pathfinder_maps(
    pathfinder: Pathfinder,
    cache_service: GameDataCacheService,
) -> None:
    """Load map data from the game data cache into the pathfinder.

    Retries with a short delay if the cache has not been populated yet
    (e.g. the background refresh has not completed its first pass).
    """
    max_attempts = 10
    for attempt in range(1, max_attempts + 1):
        try:
            async with async_session_factory() as db:
                maps = await cache_service.get_maps(db)
            if maps:
                pathfinder.load_maps(maps)
                logger.info("Pathfinder loaded %d map tiles", len(maps))
                return
            logger.info(
                "Map cache empty, retrying (%d/%d)",
                attempt,
                max_attempts,
            )
        except Exception:
            logger.exception(
                "Error loading maps into pathfinder (attempt %d/%d)",
                attempt,
                max_attempts,
            )
        await asyncio.sleep(5)

    logger.warning(
        "Pathfinder could not load maps after %d attempts; "
        "automations that depend on pathfinding will not work until maps are cached",
        max_attempts,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # --- Startup ---

    # Create tables if they do not exist (useful for dev; in prod rely on Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Instantiate shared services
    client = ArtifactsClient()
    cache_service = GameDataCacheService()
    character_service = CharacterService()

    # Event bus for internal pub/sub
    event_bus = EventBus()

    exchange_service = ExchangeService()

    app.state.artifacts_client = client
    app.state.cache_service = cache_service
    app.state.character_service = character_service
    app.state.event_bus = event_bus
    app.state.exchange_service = exchange_service

    # Start background cache refresh (runs immediately, then every 30 min)
    cache_task = cache_service.start_background_refresh(
        db_factory=async_session_factory,
        client=client,
    )

    # Start periodic character snapshot (every 60 seconds)
    snapshot_task = asyncio.create_task(
        _snapshot_loop(async_session_factory, client, character_service)
    )

    # --- Automation engine ---

    # Initialize pathfinder and load maps (runs in a background task so it
    # does not block startup if the cache has not been populated yet)
    pathfinder = Pathfinder()
    pathfinder_task = asyncio.create_task(
        _load_pathfinder_maps(pathfinder, cache_service)
    )

    # Create the automation manager and expose it on app.state
    automation_manager = AutomationManager(
        client=client,
        db_factory=async_session_factory,
        pathfinder=pathfinder,
        event_bus=event_bus,
    )
    app.state.automation_manager = automation_manager

    # --- Price capture background task ---
    price_capture_task = exchange_service.start_price_capture(
        db_factory=async_session_factory,
        client=client,
    )

    # --- WebSocket system ---

    # Game WebSocket client (connects to the Artifacts game server)
    game_ws_client = GameWebSocketClient(
        token=settings.artifacts_token,
        event_bus=event_bus,
    )
    game_ws_task = await game_ws_client.start()
    app.state.game_ws_client = game_ws_client

    # Event handler (processes game events from the bus)
    game_event_handler = GameEventHandler(event_bus=event_bus)
    event_handler_task = await game_event_handler.start()

    logger.info("Artifacts Dashboard API started")

    yield

    # --- Shutdown ---
    logger.info("Shutting down background tasks")

    # Stop all running automations gracefully
    await automation_manager.stop_all()

    # Stop WebSocket system
    await game_event_handler.stop()
    await game_ws_client.stop()

    cache_service.stop_background_refresh()
    exchange_service.stop_price_capture()
    snapshot_task.cancel()
    pathfinder_task.cancel()

    # Wait for tasks to finish cleanly
    for task in (cache_task, snapshot_task, pathfinder_task, price_capture_task, game_ws_task, event_handler_task):
        try:
            await task
        except asyncio.CancelledError:
            pass

    await client.close()
    await engine.dispose()
    logger.info("Artifacts Dashboard API stopped")


app = FastAPI(
    title="Artifacts Dashboard API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(characters_router)
app.include_router(game_data_router)
app.include_router(dashboard_router)
app.include_router(bank_router)
app.include_router(automations_router)
app.include_router(ws_router)
app.include_router(exchange_router)
app.include_router(events_router)
app.include_router(logs_router)
app.include_router(auth_router)
app.include_router(workflows_router)
app.include_router(errors_router)
app.include_router(pipelines_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
