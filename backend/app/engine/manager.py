from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.engine.cooldown import CooldownTracker
from app.engine.pathfinder import Pathfinder
from app.engine.runner import AutomationRunner
from app.engine.strategies.base import BaseStrategy
from app.engine.strategies.combat import CombatStrategy
from app.engine.strategies.crafting import CraftingStrategy
from app.engine.strategies.gathering import GatheringStrategy
from app.engine.strategies.leveling import LevelingStrategy
from app.engine.strategies.task import TaskStrategy
from app.engine.strategies.trading import TradingStrategy
from app.models.automation import AutomationConfig, AutomationLog, AutomationRun
from app.schemas.automation import (
    AutomationLogResponse,
    AutomationRunResponse,
    AutomationStatusResponse,
)
from app.services.artifacts_client import ArtifactsClient

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)


class AutomationManager:
    """Central manager that orchestrates all automation runners.

    One manager exists per application instance and is stored on
    ``app.state.automation_manager``. It holds references to all active
    runners (keyed by ``config_id``) and provides high-level start / stop /
    pause / resume operations.
    """

    def __init__(
        self,
        client: ArtifactsClient,
        db_factory: async_sessionmaker[AsyncSession],
        pathfinder: Pathfinder,
        event_bus: EventBus | None = None,
    ) -> None:
        self._client = client
        self._db_factory = db_factory
        self._pathfinder = pathfinder
        self._event_bus = event_bus
        self._runners: dict[int, AutomationRunner] = {}
        self._cooldown_tracker = CooldownTracker()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self, config_id: int) -> AutomationRunResponse:
        """Start an automation from its persisted configuration.

        Creates a new :class:`AutomationRun` record and spawns an
        :class:`AutomationRunner` task.

        Raises
        ------
        ValueError
            If the config does not exist, is disabled, or is already running.
        """
        # Prevent duplicate runners
        if config_id in self._runners:
            runner = self._runners[config_id]
            if runner.is_running or runner.is_paused:
                raise ValueError(
                    f"Automation config {config_id} is already running "
                    f"(run_id={runner.run_id}, status={runner.status})"
                )

        async with self._db_factory() as db:
            # Load the config
            config = await db.get(AutomationConfig, config_id)
            if config is None:
                raise ValueError(f"Automation config {config_id} not found")
            if not config.enabled:
                raise ValueError(f"Automation config {config_id} is disabled")

            # Create strategy
            strategy = self._create_strategy(config.strategy_type, config.config)

            # Create run record
            run = AutomationRun(
                config_id=config_id,
                status="running",
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

            run_response = AutomationRunResponse.model_validate(run)

        # Build and start the runner
        runner = AutomationRunner(
            config_id=config_id,
            character_name=config.character_name,
            strategy=strategy,
            client=self._client,
            cooldown_tracker=self._cooldown_tracker,
            db_factory=self._db_factory,
            run_id=run.id,
            event_bus=self._event_bus,
        )
        self._runners[config_id] = runner
        await runner.start()

        logger.info(
            "Started automation config=%d character=%s strategy=%s run=%d",
            config_id,
            config.character_name,
            config.strategy_type,
            run.id,
        )
        return run_response

    async def stop(self, config_id: int) -> None:
        """Stop a running automation.

        Raises
        ------
        ValueError
            If no runner exists for the given config.
        """
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")

        await runner.stop()
        del self._runners[config_id]
        logger.info("Stopped automation config=%d", config_id)

    async def pause(self, config_id: int) -> None:
        """Pause a running automation.

        Raises
        ------
        ValueError
            If no runner exists for the given config or it is not running.
        """
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")
        if not runner.is_running:
            raise ValueError(f"Runner for config {config_id} is not running (status={runner.status})")

        await runner.pause()

    async def resume(self, config_id: int) -> None:
        """Resume a paused automation.

        Raises
        ------
        ValueError
            If no runner exists for the given config or it is not paused.
        """
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")
        if not runner.is_paused:
            raise ValueError(f"Runner for config {config_id} is not paused (status={runner.status})")

        await runner.resume()

    async def stop_all(self) -> None:
        """Stop all running automations (used during shutdown)."""
        config_ids = list(self._runners.keys())
        for config_id in config_ids:
            try:
                await self.stop(config_id)
            except Exception:
                logger.exception("Error stopping automation config=%d", config_id)

    # ------------------------------------------------------------------
    # Status queries
    # ------------------------------------------------------------------

    def get_status(self, config_id: int) -> AutomationStatusResponse | None:
        """Return the live status of a single automation, or ``None``."""
        runner = self._runners.get(config_id)
        if runner is None:
            return None
        return AutomationStatusResponse(
            config_id=runner.config_id,
            character_name=runner.character_name,
            strategy_type=runner.strategy_state,
            status=runner.status,
            run_id=runner.run_id,
            actions_count=runner.actions_count,
        )

    def get_all_statuses(self) -> list[AutomationStatusResponse]:
        """Return live status for all active automations."""
        return [
            AutomationStatusResponse(
                config_id=r.config_id,
                character_name=r.character_name,
                strategy_type=r.strategy_state,
                status=r.status,
                run_id=r.run_id,
                actions_count=r.actions_count,
            )
            for r in self._runners.values()
        ]

    def is_running(self, config_id: int) -> bool:
        """Return True if there is an active runner for the config."""
        runner = self._runners.get(config_id)
        return runner is not None and (runner.is_running or runner.is_paused)

    # ------------------------------------------------------------------
    # Strategy factory
    # ------------------------------------------------------------------

    def _create_strategy(self, strategy_type: str, config: dict) -> BaseStrategy:
        """Instantiate a strategy by type name."""
        match strategy_type:
            case "combat":
                return CombatStrategy(config, self._pathfinder)
            case "gathering":
                return GatheringStrategy(config, self._pathfinder)
            case "crafting":
                return CraftingStrategy(config, self._pathfinder)
            case "trading":
                return TradingStrategy(config, self._pathfinder)
            case "task":
                return TaskStrategy(config, self._pathfinder)
            case "leveling":
                return LevelingStrategy(config, self._pathfinder)
            case _:
                raise ValueError(
                    f"Unknown strategy type: {strategy_type!r}. "
                    f"Supported: combat, gathering, crafting, trading, task, leveling"
                )
