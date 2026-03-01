"""CharacterWorker — runs one character's strategy within a pipeline stage.

Same tick loop pattern as WorkflowRunner._tick(): wait cooldown -> get
character -> get action -> check transition -> execute action.  Reuses the
shared ``execute_action`` helper and the existing ``TransitionEvaluator``.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Any

from app.engine.action_executor import execute_action
from app.engine.cooldown import CooldownTracker
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.engine.workflow.conditions import TransitionEvaluator
from app.services.artifacts_client import ArtifactsClient

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)

_ERROR_RETRY_DELAY: float = 2.0
_MAX_CONSECUTIVE_ERRORS: int = 10


class CharacterWorker:
    """Drives a single character's strategy within a pipeline stage."""

    def __init__(
        self,
        pipeline_id: int,
        stage_id: str,
        step: dict,
        strategy: BaseStrategy,
        client: ArtifactsClient,
        cooldown_tracker: CooldownTracker,
        event_bus: EventBus | None = None,
    ) -> None:
        self._pipeline_id = pipeline_id
        self._stage_id = stage_id
        self._step = step
        self._character_name: str = step["character_name"]
        self._step_id: str = step["id"]
        self._strategy = strategy
        self._client = client
        self._cooldown = cooldown_tracker
        self._event_bus = event_bus

        self._transition_evaluator = TransitionEvaluator(client)
        self._running = False
        self._completed = False
        self._errored = False
        self._error_message: str | None = None
        self._task: asyncio.Task[None] | None = None
        self._actions_count: int = 0
        self._step_start_time: float = 0.0
        self._consecutive_errors: int = 0

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def character_name(self) -> str:
        return self._character_name

    @property
    def step_id(self) -> str:
        return self._step_id

    @property
    def is_completed(self) -> bool:
        return self._completed

    @property
    def is_errored(self) -> bool:
        return self._errored

    @property
    def is_running(self) -> bool:
        return self._running and not self._completed and not self._errored

    @property
    def actions_count(self) -> int:
        return self._actions_count

    @property
    def strategy_state(self) -> str:
        return self._strategy.get_state() if self._strategy else ""

    @property
    def error_message(self) -> str | None:
        return self._error_message

    @property
    def status(self) -> str:
        if self._errored:
            return "error"
        if self._completed:
            return "completed"
        if self._running:
            return "running"
        return "idle"

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._step_start_time = time.time()
        self._transition_evaluator.reset()
        self._task = asyncio.create_task(
            self._run_loop(),
            name=f"pipeline-{self._pipeline_id}-{self._character_name}",
        )

    async def stop(self) -> None:
        self._running = False
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        try:
            while self._running and not self._completed:
                try:
                    await self._tick()
                    self._consecutive_errors = 0
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    self._consecutive_errors += 1
                    logger.exception(
                        "Error in pipeline worker %s/%s (error %d/%d): %s",
                        self._pipeline_id,
                        self._character_name,
                        self._consecutive_errors,
                        _MAX_CONSECUTIVE_ERRORS,
                        exc,
                    )
                    if self._consecutive_errors >= _MAX_CONSECUTIVE_ERRORS:
                        self._errored = True
                        self._error_message = (
                            f"Stopped after {_MAX_CONSECUTIVE_ERRORS} "
                            f"consecutive errors. Last: {exc}"
                        )
                        self._running = False
                        return
                    await asyncio.sleep(_ERROR_RETRY_DELAY)
        except asyncio.CancelledError:
            logger.info(
                "Pipeline worker %s/%s cancelled",
                self._pipeline_id,
                self._character_name,
            )

    async def _tick(self) -> None:
        if self._strategy is None:
            self._errored = True
            self._error_message = "No strategy configured"
            self._running = False
            return

        # 1. Wait for cooldown
        await self._cooldown.wait(self._character_name)

        # 2. Fetch character state
        character = await self._client.get_character(self._character_name)

        # 3. Ask strategy for next action
        plan = await self._strategy.next_action(character)
        strategy_completed = plan.action_type == ActionType.COMPLETE

        # 4. Check transition condition
        transition = self._step.get("transition")
        if transition is not None:
            should_advance = await self._transition_evaluator.should_transition(
                transition,
                character,
                actions_count=self._actions_count,
                step_start_time=self._step_start_time,
                strategy_completed=strategy_completed,
            )
            if should_advance:
                self._completed = True
                self._running = False
                return

        # 5. If strategy completed and no transition, treat as done
        if strategy_completed:
            if transition is None:
                self._completed = True
                self._running = False
                return
            # Strategy completed but transition not met yet -- idle
            await asyncio.sleep(1)
            return

        if plan.action_type == ActionType.IDLE:
            await asyncio.sleep(1)
            return

        # 6. Execute the action
        result = await execute_action(self._client, self._character_name, plan)

        # 7. Update cooldown
        cooldown = result.get("cooldown")
        if cooldown:
            self._cooldown.update(
                self._character_name,
                cooldown.get("total_seconds", 0),
                cooldown.get("expiration"),
            )

        # 8. Record
        self._actions_count += 1

        # 9. Publish character update
        if self._event_bus is not None:
            try:
                await self._event_bus.publish(
                    "character_update",
                    {"character_name": self._character_name},
                )
            except Exception:
                pass
