from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.engine.action_executor import execute_action
from app.engine.cooldown import CooldownTracker
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.models.automation import AutomationLog, AutomationRun
from app.services.artifacts_client import ArtifactsClient
from app.services.error_service import hash_token, log_error

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)

# Delay before retrying after an unhandled error in the run loop
_ERROR_RETRY_DELAY: float = 2.0

# Maximum consecutive errors before the runner stops itself
_MAX_CONSECUTIVE_ERRORS: int = 10


class AutomationRunner:
    """Drives the automation loop for a single character.

    Each runner owns an ``asyncio.Task`` that repeatedly:

    1. Waits for the character's cooldown to expire.
    2. Fetches the current character state from the API.
    3. Asks the strategy for the next action.
    4. Executes that action via the artifacts client.
    5. Records the cooldown and logs the result to the database.

    The runner can be paused, resumed, or stopped at any time.
    """

    def __init__(
        self,
        config_id: int,
        character_name: str,
        strategy: BaseStrategy,
        client: ArtifactsClient,
        cooldown_tracker: CooldownTracker,
        db_factory: async_sessionmaker[AsyncSession],
        run_id: int,
        event_bus: EventBus | None = None,
    ) -> None:
        self._config_id = config_id
        self._character_name = character_name
        self._strategy = strategy
        self._client = client
        self._cooldown = cooldown_tracker
        self._db_factory = db_factory
        self._run_id = run_id
        self._event_bus = event_bus

        self._running = False
        self._paused = False
        self._task: asyncio.Task[None] | None = None
        self._actions_count: int = 0
        self._consecutive_errors: int = 0

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def config_id(self) -> int:
        return self._config_id

    @property
    def character_name(self) -> str:
        return self._character_name

    @property
    def run_id(self) -> int:
        return self._run_id

    @property
    def actions_count(self) -> int:
        return self._actions_count

    @property
    def is_running(self) -> bool:
        return self._running and not self._paused

    @property
    def is_paused(self) -> bool:
        return self._running and self._paused

    @property
    def status(self) -> str:
        if not self._running:
            return "stopped"
        if self._paused:
            return "paused"
        return "running"

    @property
    def strategy_state(self) -> str:
        return self._strategy.get_state()

    # ------------------------------------------------------------------
    # Event bus helpers
    # ------------------------------------------------------------------

    async def _publish(self, event_type: str, data: dict) -> None:
        """Publish an event to the event bus if one is configured."""
        if self._event_bus is not None:
            try:
                await self._event_bus.publish(event_type, data)
            except Exception:
                logger.exception("Failed to publish event %s", event_type)

    async def _publish_status(self, status: str) -> None:
        """Publish an automation_status_changed event."""
        await self._publish(
            "automation_status_changed",
            {
                "config_id": self._config_id,
                "character_name": self._character_name,
                "status": status,
                "run_id": self._run_id,
            },
        )

    async def _publish_action(
        self,
        action_type: str,
        success: bool,
        details: dict | None = None,
    ) -> None:
        """Publish an automation_action event."""
        await self._publish(
            "automation_action",
            {
                "config_id": self._config_id,
                "character_name": self._character_name,
                "action_type": action_type,
                "success": success,
                "details": details or {},
                "actions_count": self._actions_count,
            },
        )

    async def _publish_character_update(self) -> None:
        """Publish a character_update event to trigger frontend re-fetch."""
        await self._publish(
            "character_update",
            {
                "character_name": self._character_name,
            },
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the automation loop in a background task."""
        if self._running:
            logger.warning("Runner for config %d is already running", self._config_id)
            return
        self._running = True
        self._paused = False
        self._task = asyncio.create_task(
            self._run_loop(),
            name=f"automation-{self._config_id}-{self._character_name}",
        )
        logger.info(
            "Started automation runner for config %d (character=%s, run=%d)",
            self._config_id,
            self._character_name,
            self._run_id,
        )
        await self._publish_status("running")

    async def stop(self, error_message: str | None = None) -> None:
        """Stop the automation loop and finalize the run record."""
        self._running = False
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

        # Update the run record in the database
        final_status = "error" if error_message else "stopped"
        await self._finalize_run(
            status=final_status,
            error_message=error_message,
        )
        logger.info(
            "Stopped automation runner for config %d (actions=%d)",
            self._config_id,
            self._actions_count,
        )
        await self._publish_status(final_status)

    async def pause(self) -> None:
        """Pause the automation loop (the task keeps running but idles)."""
        self._paused = True
        await self._update_run_status("paused")
        logger.info("Paused automation runner for config %d", self._config_id)
        await self._publish_status("paused")

    async def resume(self) -> None:
        """Resume a paused automation loop."""
        self._paused = False
        await self._update_run_status("running")
        logger.info("Resumed automation runner for config %d", self._config_id)
        await self._publish_status("running")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        """Core automation loop -- runs until stopped or the strategy completes."""
        try:
            while self._running:
                if self._paused:
                    await asyncio.sleep(1)
                    continue

                try:
                    await self._tick()
                    self._consecutive_errors = 0
                except asyncio.CancelledError:
                    raise
                except httpx.HTTPStatusError as exc:
                    status = exc.response.status_code
                    # 498 = character in cooldown – not a real error,
                    # just wait and retry without incrementing the counter.
                    if status == 498:
                        logger.info(
                            "Cooldown error for config %d, will retry",
                            self._config_id,
                        )
                        await asyncio.sleep(_ERROR_RETRY_DELAY)
                        continue
                    # Other HTTP errors – treat as real failures
                    self._consecutive_errors += 1
                    logger.exception(
                        "HTTP %d in automation loop for config %d (error %d/%d): %s",
                        status,
                        self._config_id,
                        self._consecutive_errors,
                        _MAX_CONSECUTIVE_ERRORS,
                        exc,
                    )
                    await log_error(
                        self._db_factory,
                        severity="error",
                        source="automation",
                        exc=exc,
                        context={
                            "config_id": self._config_id,
                            "character": self._character_name,
                            "run_id": self._run_id,
                            "consecutive_errors": self._consecutive_errors,
                            "http_status": status,
                        },
                    )
                    await self._log_action(
                        ActionPlan(ActionType.IDLE, reason=str(exc)),
                        success=False,
                    )
                    await self._publish_action(
                        "error",
                        success=False,
                        details={"error": str(exc)},
                    )
                    if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                        logger.error(
                            "Too many consecutive errors for config %d, stopping",
                            self._config_id,
                        )
                        await self._finalize_run(
                            status="error",
                            error_message=f"Stopped after {_MAX_CONSECUTIVE_ERRORS} consecutive errors. Last: {exc}",
                        )
                        self._running = False
                        await self._publish_status("error")
                        return
                    await asyncio.sleep(_ERROR_RETRY_DELAY)
                except Exception as exc:
                    self._consecutive_errors += 1
                    logger.exception(
                        "Error in automation loop for config %d (error %d/%d): %s",
                        self._config_id,
                        self._consecutive_errors,
                        _MAX_CONSECUTIVE_ERRORS,
                        exc,
                    )
                    token_hash = hash_token(self._client._token) if self._client._token else None
                    await log_error(
                        self._db_factory,
                        severity="error",
                        source="automation",
                        exc=exc,
                        context={
                            "config_id": self._config_id,
                            "character": self._character_name,
                            "run_id": self._run_id,
                            "consecutive_errors": self._consecutive_errors,
                        },
                        user_token_hash=token_hash,
                    )
                    await self._log_action(
                        ActionPlan(ActionType.IDLE, reason=str(exc)),
                        success=False,
                    )
                    await self._publish_action(
                        "error",
                        success=False,
                        details={"error": str(exc)},
                    )
                    if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                        logger.error(
                            "Too many consecutive errors for config %d, stopping",
                            self._config_id,
                        )
                        await self._finalize_run(
                            status="error",
                            error_message=f"Stopped after {_MAX_CONSECUTIVE_ERRORS} consecutive errors. Last: {exc}",
                        )
                        self._running = False
                        await self._publish_status("error")
                        return
                    await asyncio.sleep(_ERROR_RETRY_DELAY)

        except asyncio.CancelledError:
            logger.info("Automation loop for config %d was cancelled", self._config_id)

    async def _tick(self) -> None:
        """Execute a single iteration of the automation loop."""
        # 1. Wait for cooldown
        await self._cooldown.wait(self._character_name)

        # 2. Fetch current character state
        character = await self._client.get_character(self._character_name)

        # 3. Ask strategy for the next action
        plan = await self._strategy.next_action(character)

        # 4. Handle terminal actions
        if plan.action_type == ActionType.COMPLETE:
            logger.info(
                "Strategy completed for config %d: %s",
                self._config_id,
                plan.reason,
            )
            await self._log_action(plan, success=True)
            await self._finalize_run(status="completed")
            self._running = False
            await self._publish_status("completed")
            await self._publish_action(
                plan.action_type.value,
                success=True,
                details={"reason": plan.reason},
            )
            return

        if plan.action_type == ActionType.IDLE:
            logger.debug(
                "Strategy idle for config %d: %s",
                self._config_id,
                plan.reason,
            )
            await asyncio.sleep(1)
            return

        # 5. Execute the action
        result = await self._execute_action(plan)

        # 6. Update cooldown from response
        self._update_cooldown_from_result(result)

        # 7. Record success
        self._actions_count += 1
        await self._log_action(plan, success=True)

        # 8. Publish events for the frontend
        await self._publish_action(
            plan.action_type.value,
            success=True,
            details={
                "params": plan.params,
                "reason": plan.reason,
                "strategy_state": self._strategy.get_state(),
            },
        )
        await self._publish_character_update()

    # ------------------------------------------------------------------
    # Action execution
    # ------------------------------------------------------------------

    async def _execute_action(self, plan: ActionPlan) -> dict[str, Any]:
        """Dispatch an action plan to the appropriate client method."""
        return await execute_action(self._client, self._character_name, plan)

    def _update_cooldown_from_result(self, result: dict[str, Any]) -> None:
        """Extract cooldown information from an action response and update the tracker."""
        cooldown = result.get("cooldown")
        if cooldown is None:
            return
        self._cooldown.update(
            self._character_name,
            cooldown.get("total_seconds", 0),
            cooldown.get("expiration"),
        )

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def _log_action(self, plan: ActionPlan, success: bool) -> None:
        """Write an action log entry and update the run's action count."""
        try:
            async with self._db_factory() as db:
                log = AutomationLog(
                    run_id=self._run_id,
                    action_type=plan.action_type.value,
                    details={
                        "params": plan.params,
                        "reason": plan.reason,
                        "strategy_state": self._strategy.get_state(),
                    },
                    success=success,
                )
                db.add(log)

                # Update the run's action counter
                stmt = select(AutomationRun).where(AutomationRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.actions_count = self._actions_count

                await db.commit()
        except Exception:
            logger.exception("Failed to log action for run %d", self._run_id)

    async def _update_run_status(self, status: str) -> None:
        """Update the status field of the current run."""
        try:
            async with self._db_factory() as db:
                stmt = select(AutomationRun).where(AutomationRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                await db.commit()
        except Exception:
            logger.exception("Failed to update run %d status to %s", self._run_id, status)

    async def _finalize_run(
        self,
        status: str,
        error_message: str | None = None,
    ) -> None:
        """Mark the run as finished with a final status and timestamp."""
        try:
            async with self._db_factory() as db:
                stmt = select(AutomationRun).where(AutomationRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                    run.stopped_at = datetime.now(timezone.utc)
                    run.actions_count = self._actions_count
                    if error_message:
                        run.error_message = error_message
                await db.commit()
        except Exception:
            logger.exception("Failed to finalize run %d", self._run_id)
