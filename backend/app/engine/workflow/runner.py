from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.engine.action_executor import execute_action
from app.engine.cooldown import CooldownTracker
from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.engine.workflow.conditions import TransitionEvaluator
from app.models.automation import AutomationLog
from app.models.workflow import WorkflowRun
from app.services.artifacts_client import ArtifactsClient

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)

_ERROR_RETRY_DELAY: float = 2.0
_MAX_CONSECUTIVE_ERRORS: int = 10


class WorkflowRunner:
    """Runs a multi-step workflow pipeline for a single character.

    Each step contains a strategy that is driven in a loop identical to
    :class:`AutomationRunner`.  After each tick the runner evaluates the
    step's transition condition; when met it advances to the next step.
    """

    def __init__(
        self,
        workflow_id: int,
        character_name: str,
        steps: list[dict],
        loop: bool,
        max_loops: int,
        strategy_factory: Any,  # callable(strategy_type, config) -> BaseStrategy
        client: ArtifactsClient,
        cooldown_tracker: CooldownTracker,
        db_factory: async_sessionmaker[AsyncSession],
        run_id: int,
        event_bus: EventBus | None = None,
    ) -> None:
        self._workflow_id = workflow_id
        self._character_name = character_name
        self._steps = steps
        self._loop = loop
        self._max_loops = max_loops
        self._strategy_factory = strategy_factory
        self._client = client
        self._cooldown = cooldown_tracker
        self._db_factory = db_factory
        self._run_id = run_id
        self._event_bus = event_bus

        self._running = False
        self._paused = False
        self._task: asyncio.Task[None] | None = None

        # Runtime state
        self._current_step_index: int = 0
        self._loop_count: int = 0
        self._total_actions: int = 0
        self._step_actions: int = 0
        self._step_start_time: float = 0.0
        self._step_history: list[dict] = []
        self._consecutive_errors: int = 0

        # Current strategy
        self._strategy: BaseStrategy | None = None
        self._transition_evaluator = TransitionEvaluator(client)

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def workflow_id(self) -> int:
        return self._workflow_id

    @property
    def character_name(self) -> str:
        return self._character_name

    @property
    def run_id(self) -> int:
        return self._run_id

    @property
    def current_step_index(self) -> int:
        return self._current_step_index

    @property
    def current_step_id(self) -> str:
        if 0 <= self._current_step_index < len(self._steps):
            return self._steps[self._current_step_index].get("id", "")
        return ""

    @property
    def loop_count(self) -> int:
        return self._loop_count

    @property
    def total_actions_count(self) -> int:
        return self._total_actions

    @property
    def step_actions_count(self) -> int:
        return self._step_actions

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
        if self._strategy is not None:
            return self._strategy.get_state()
        return ""

    # ------------------------------------------------------------------
    # Event bus helpers
    # ------------------------------------------------------------------

    async def _publish(self, event_type: str, data: dict) -> None:
        if self._event_bus is not None:
            try:
                await self._event_bus.publish(event_type, data)
            except Exception:
                logger.exception("Failed to publish event %s", event_type)

    async def _publish_status(self, status: str) -> None:
        await self._publish(
            "workflow_status_changed",
            {
                "workflow_id": self._workflow_id,
                "character_name": self._character_name,
                "status": status,
                "run_id": self._run_id,
                "current_step_index": self._current_step_index,
                "loop_count": self._loop_count,
            },
        )

    async def _publish_action(
        self,
        action_type: str,
        success: bool,
        details: dict | None = None,
    ) -> None:
        await self._publish(
            "workflow_action",
            {
                "workflow_id": self._workflow_id,
                "character_name": self._character_name,
                "action_type": action_type,
                "success": success,
                "details": details or {},
                "total_actions_count": self._total_actions,
                "step_index": self._current_step_index,
            },
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._paused = False

        # Initialize strategy for the first step
        self._init_step(self._current_step_index)

        self._task = asyncio.create_task(
            self._run_loop(),
            name=f"workflow-{self._workflow_id}-{self._character_name}",
        )
        logger.info(
            "Started workflow runner workflow=%d character=%s run=%d",
            self._workflow_id,
            self._character_name,
            self._run_id,
        )
        await self._publish_status("running")

    async def stop(self, error_message: str | None = None) -> None:
        self._running = False
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

        final_status = "error" if error_message else "stopped"
        await self._finalize_run(status=final_status, error_message=error_message)
        logger.info(
            "Stopped workflow runner workflow=%d (actions=%d)",
            self._workflow_id,
            self._total_actions,
        )
        await self._publish_status(final_status)

    async def pause(self) -> None:
        self._paused = True
        await self._update_run_status("paused")
        await self._publish_status("paused")

    async def resume(self) -> None:
        self._paused = False
        await self._update_run_status("running")
        await self._publish_status("running")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
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
                except Exception as exc:
                    self._consecutive_errors += 1
                    logger.exception(
                        "Error in workflow loop workflow=%d (error %d/%d): %s",
                        self._workflow_id,
                        self._consecutive_errors,
                        _MAX_CONSECUTIVE_ERRORS,
                        exc,
                    )
                    await self._log_action(
                        ActionPlan(ActionType.IDLE, reason=str(exc)),
                        success=False,
                    )
                    if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                        logger.error(
                            "Too many consecutive errors for workflow %d, stopping",
                            self._workflow_id,
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
            logger.info("Workflow loop for %d was cancelled", self._workflow_id)

    async def _tick(self) -> None:
        """Execute a single iteration of the workflow loop."""
        if self._strategy is None:
            logger.error("No strategy for workflow %d step %d", self._workflow_id, self._current_step_index)
            self._running = False
            return

        # 1. Wait for cooldown
        await self._cooldown.wait(self._character_name)

        # 2. Fetch character
        character = await self._client.get_character(self._character_name)

        # 3. Ask strategy for next action
        plan = await self._strategy.next_action(character)

        strategy_completed = plan.action_type == ActionType.COMPLETE

        # 4. Check transition condition BEFORE executing the action
        step = self._steps[self._current_step_index]
        transition = step.get("transition")

        if transition is not None:
            should_advance = await self._transition_evaluator.should_transition(
                transition,
                character,
                actions_count=self._step_actions,
                step_start_time=self._step_start_time,
                strategy_completed=strategy_completed,
            )
            if should_advance:
                await self._advance_step()
                return

        # 5. If strategy completed and no transition, treat it as step done
        if strategy_completed:
            if transition is None:
                # No explicit transition means strategy_complete is the implicit trigger
                await self._advance_step()
                return
            # Strategy completed but transition not met yet -- idle
            await asyncio.sleep(1)
            return

        if plan.action_type == ActionType.IDLE:
            await asyncio.sleep(1)
            return

        # 6. Execute the action
        result = await self._execute_action(plan)

        # 7. Update cooldown
        self._update_cooldown_from_result(result)

        # 8. Record
        self._total_actions += 1
        self._step_actions += 1
        await self._log_action(plan, success=True)

        # 9. Publish
        await self._publish_action(
            plan.action_type.value,
            success=True,
            details={
                "params": plan.params,
                "reason": plan.reason,
                "strategy_state": self._strategy.get_state() if self._strategy else "",
                "step_index": self._current_step_index,
            },
        )
        await self._publish(
            "character_update",
            {"character_name": self._character_name},
        )

    # ------------------------------------------------------------------
    # Step management
    # ------------------------------------------------------------------

    def _init_step(self, index: int) -> None:
        """Initialize a strategy for the step at the given index."""
        if index < 0 or index >= len(self._steps):
            self._strategy = None
            return

        step = self._steps[index]
        self._current_step_index = index
        self._step_actions = 0
        self._step_start_time = time.time()
        self._transition_evaluator.reset()

        try:
            self._strategy = self._strategy_factory(
                step["strategy_type"],
                step.get("config", {}),
            )
        except Exception:
            logger.exception(
                "Failed to create strategy for workflow %d step %d",
                self._workflow_id,
                index,
            )
            self._strategy = None

        logger.info(
            "Workflow %d initialized step %d/%d: %s (%s)",
            self._workflow_id,
            index + 1,
            len(self._steps),
            step.get("name", ""),
            step.get("strategy_type", ""),
        )

    async def _advance_step(self) -> None:
        """Advance to the next step or finish the workflow."""
        # Record completed step
        step = self._steps[self._current_step_index]
        self._step_history.append({
            "step_id": step.get("id", ""),
            "step_name": step.get("name", ""),
            "actions_count": self._step_actions,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        logger.info(
            "Workflow %d step %d completed (%s, %d actions)",
            self._workflow_id,
            self._current_step_index,
            step.get("name", ""),
            self._step_actions,
        )

        next_index = self._current_step_index + 1

        if next_index >= len(self._steps):
            # Reached end of steps
            if self._loop:
                self._loop_count += 1
                if self._max_loops > 0 and self._loop_count >= self._max_loops:
                    # Hit loop limit
                    await self._finalize_run(status="completed")
                    self._running = False
                    await self._publish_status("completed")
                    return

                # Loop back to step 0
                logger.info(
                    "Workflow %d looping (loop %d)",
                    self._workflow_id,
                    self._loop_count,
                )
                self._init_step(0)
            else:
                # No loop, workflow complete
                await self._finalize_run(status="completed")
                self._running = False
                await self._publish_status("completed")
                return
        else:
            # Advance to next step
            self._init_step(next_index)

        # Update run record
        await self._update_run_progress()
        await self._publish_status("running")

    # ------------------------------------------------------------------
    # Action execution (mirrors AutomationRunner._execute_action)
    # ------------------------------------------------------------------

    async def _execute_action(self, plan: ActionPlan) -> dict[str, Any]:
        return await execute_action(self._client, self._character_name, plan)

    def _update_cooldown_from_result(self, result: dict[str, Any]) -> None:
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
        try:
            async with self._db_factory() as db:
                log = AutomationLog(
                    run_id=self._run_id,
                    action_type=plan.action_type.value,
                    details={
                        "params": plan.params,
                        "reason": plan.reason,
                        "strategy_state": self._strategy.get_state() if self._strategy else "",
                        "workflow_id": self._workflow_id,
                        "step_index": self._current_step_index,
                    },
                    success=success,
                )
                db.add(log)
                await db.commit()
        except Exception:
            logger.exception("Failed to log workflow action for run %d", self._run_id)

    async def _update_run_status(self, status: str) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(WorkflowRun).where(WorkflowRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                await db.commit()
        except Exception:
            logger.exception("Failed to update workflow run %d status", self._run_id)

    async def _update_run_progress(self) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(WorkflowRun).where(WorkflowRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.current_step_index = self._current_step_index
                    run.current_step_id = self.current_step_id
                    run.loop_count = self._loop_count
                    run.total_actions_count = self._total_actions
                    run.step_actions_count = self._step_actions
                    run.step_history = self._step_history
                await db.commit()
        except Exception:
            logger.exception("Failed to update workflow run %d progress", self._run_id)

    async def _finalize_run(
        self,
        status: str,
        error_message: str | None = None,
    ) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(WorkflowRun).where(WorkflowRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                    run.stopped_at = datetime.now(timezone.utc)
                    run.current_step_index = self._current_step_index
                    run.current_step_id = self.current_step_id
                    run.loop_count = self._loop_count
                    run.total_actions_count = self._total_actions
                    run.step_actions_count = self._step_actions
                    run.step_history = self._step_history
                    if error_message:
                        run.error_message = error_message
                await db.commit()
        except Exception:
            logger.exception("Failed to finalize workflow run %d", self._run_id)
