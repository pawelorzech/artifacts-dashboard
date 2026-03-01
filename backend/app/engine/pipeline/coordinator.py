"""PipelineCoordinator — orchestrates stages sequentially with parallel character workers."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.engine.cooldown import CooldownTracker
from app.engine.pipeline.worker import CharacterWorker
from app.engine.strategies.base import BaseStrategy
from app.models.pipeline import PipelineRun
from app.services.artifacts_client import ArtifactsClient

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)


class PipelineCoordinator:
    """Orchestrates a multi-character pipeline.

    Iterates stages sequentially.  For each stage, spawns a
    ``CharacterWorker`` per character-step and waits for all of them to
    complete their transition (or error).  Then advances to the next stage.
    """

    def __init__(
        self,
        pipeline_id: int,
        stages: list[dict],
        loop: bool,
        max_loops: int,
        strategy_factory: Any,  # callable(strategy_type, config) -> BaseStrategy
        client: ArtifactsClient,
        cooldown_tracker: CooldownTracker,
        db_factory: async_sessionmaker[AsyncSession],
        run_id: int,
        event_bus: EventBus | None = None,
    ) -> None:
        self._pipeline_id = pipeline_id
        self._stages = stages
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
        self._current_stage_index: int = 0
        self._loop_count: int = 0
        self._total_actions: int = 0
        self._stage_history: list[dict] = []
        self._workers: list[CharacterWorker] = []

        # Track ALL characters across ALL stages for busy-checking
        self._all_characters: set[str] = set()
        for stage in stages:
            for cs in stage.get("character_steps", []):
                self._all_characters.add(cs["character_name"])

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def pipeline_id(self) -> int:
        return self._pipeline_id

    @property
    def run_id(self) -> int:
        return self._run_id

    @property
    def all_characters(self) -> set[str]:
        return self._all_characters

    @property
    def active_characters(self) -> set[str]:
        """Characters currently executing in the active stage."""
        return {w.character_name for w in self._workers if w.is_running}

    @property
    def current_stage_index(self) -> int:
        return self._current_stage_index

    @property
    def current_stage_id(self) -> str:
        if 0 <= self._current_stage_index < len(self._stages):
            return self._stages[self._current_stage_index].get("id", "")
        return ""

    @property
    def loop_count(self) -> int:
        return self._loop_count

    @property
    def total_actions_count(self) -> int:
        return self._total_actions + sum(w.actions_count for w in self._workers)

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
    def character_states(self) -> dict[str, dict]:
        """Current state of each worker for status reporting."""
        result: dict[str, dict] = {}
        for w in self._workers:
            result[w.character_name] = {
                "status": w.status,
                "step_id": w.step_id,
                "actions_count": w.actions_count,
                "strategy_state": w.strategy_state,
                "error": w.error_message,
            }
        return result

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
            "pipeline_status_changed",
            {
                "pipeline_id": self._pipeline_id,
                "status": status,
                "run_id": self._run_id,
                "current_stage_index": self._current_stage_index,
                "loop_count": self._loop_count,
                "character_states": self.character_states,
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
        self._task = asyncio.create_task(
            self._run_loop(),
            name=f"pipeline-coord-{self._pipeline_id}",
        )
        logger.info(
            "Started pipeline coordinator pipeline=%d run=%d stages=%d characters=%s",
            self._pipeline_id,
            self._run_id,
            len(self._stages),
            sorted(self._all_characters),
        )
        await self._publish_status("running")

    async def stop(self, error_message: str | None = None) -> None:
        self._running = False
        # Stop all active workers
        for w in self._workers:
            await w.stop()
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

        final_status = "error" if error_message else "stopped"
        await self._finalize_run(status=final_status, error_message=error_message)
        logger.info("Stopped pipeline %d (actions=%d)", self._pipeline_id, self.total_actions_count)
        await self._publish_status(final_status)

    async def pause(self) -> None:
        self._paused = True
        for w in self._workers:
            await w.stop()
        await self._update_run_status("paused")
        await self._publish_status("paused")

    async def resume(self) -> None:
        self._paused = False
        # Workers will be re-created by the main loop on next iteration
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
                    completed = await self._run_stage(self._current_stage_index)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.exception(
                        "Error running stage %d of pipeline %d: %s",
                        self._current_stage_index,
                        self._pipeline_id,
                        exc,
                    )
                    await self._finalize_run(
                        status="error",
                        error_message=f"Stage {self._current_stage_index} error: {exc}",
                    )
                    self._running = False
                    await self._publish_status("error")
                    return

                if not self._running:
                    return

                if not completed:
                    # Stage had errors
                    await self._finalize_run(
                        status="error",
                        error_message="Stage workers encountered errors",
                    )
                    self._running = False
                    await self._publish_status("error")
                    return

                # Stage completed — record and advance
                stage = self._stages[self._current_stage_index]
                self._total_actions += sum(w.actions_count for w in self._workers)
                self._stage_history.append({
                    "stage_id": stage.get("id", ""),
                    "stage_name": stage.get("name", ""),
                    "character_actions": {
                        w.character_name: w.actions_count for w in self._workers
                    },
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })
                self._workers = []

                logger.info(
                    "Pipeline %d stage %d/%d completed (%s)",
                    self._pipeline_id,
                    self._current_stage_index + 1,
                    len(self._stages),
                    stage.get("name", ""),
                )

                next_index = self._current_stage_index + 1
                if next_index >= len(self._stages):
                    # End of pipeline
                    if self._loop:
                        self._loop_count += 1
                        if self._max_loops > 0 and self._loop_count >= self._max_loops:
                            await self._finalize_run(status="completed")
                            self._running = False
                            await self._publish_status("completed")
                            return
                        # Loop back to stage 0
                        logger.info("Pipeline %d looping (loop %d)", self._pipeline_id, self._loop_count)
                        self._current_stage_index = 0
                    else:
                        await self._finalize_run(status="completed")
                        self._running = False
                        await self._publish_status("completed")
                        return
                else:
                    self._current_stage_index = next_index

                await self._update_run_progress()
                await self._publish_status("running")

        except asyncio.CancelledError:
            logger.info("Pipeline coordinator %d cancelled", self._pipeline_id)

    async def _run_stage(self, stage_index: int) -> bool:
        """Run all character-steps in a stage in parallel.

        Returns True if all workers completed successfully, False if any errored.
        """
        if stage_index < 0 or stage_index >= len(self._stages):
            return False

        stage = self._stages[stage_index]
        character_steps = stage.get("character_steps", [])

        logger.info(
            "Pipeline %d starting stage %d/%d: %s (%d workers)",
            self._pipeline_id,
            stage_index + 1,
            len(self._stages),
            stage.get("name", ""),
            len(character_steps),
        )

        # Create workers for each character-step
        self._workers = []
        for cs in character_steps:
            try:
                strategy = self._strategy_factory(
                    cs["strategy_type"],
                    cs.get("config", {}),
                )
            except Exception:
                logger.exception(
                    "Failed to create strategy for pipeline %d character %s",
                    self._pipeline_id,
                    cs.get("character_name", "?"),
                )
                return False

            worker = CharacterWorker(
                pipeline_id=self._pipeline_id,
                stage_id=stage.get("id", ""),
                step=cs,
                strategy=strategy,
                client=self._client,
                cooldown_tracker=self._cooldown,
                event_bus=self._event_bus,
            )
            self._workers.append(worker)

        # Start all workers in parallel
        for w in self._workers:
            await w.start()

        # Wait for all workers to complete or error
        while self._running and not self._paused:
            all_done = all(w.is_completed or w.is_errored for w in self._workers)
            if all_done:
                break
            await asyncio.sleep(0.5)

        if self._paused or not self._running:
            return False

        # Check if any worker errored
        errored = [w for w in self._workers if w.is_errored]
        if errored:
            error_msgs = "; ".join(
                f"{w.character_name}: {w.error_message}" for w in errored
            )
            logger.error(
                "Pipeline %d stage %d had worker errors: %s",
                self._pipeline_id,
                stage_index,
                error_msgs,
            )
            return False

        return True

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def _update_run_status(self, status: str) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(PipelineRun).where(PipelineRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                await db.commit()
        except Exception:
            logger.exception("Failed to update pipeline run %d status", self._run_id)

    async def _update_run_progress(self) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(PipelineRun).where(PipelineRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.current_stage_index = self._current_stage_index
                    run.current_stage_id = self.current_stage_id
                    run.loop_count = self._loop_count
                    run.total_actions_count = self.total_actions_count
                    run.character_states = self.character_states
                    run.stage_history = self._stage_history
                await db.commit()
        except Exception:
            logger.exception("Failed to update pipeline run %d progress", self._run_id)

    async def _finalize_run(
        self,
        status: str,
        error_message: str | None = None,
    ) -> None:
        try:
            async with self._db_factory() as db:
                stmt = select(PipelineRun).where(PipelineRun.id == self._run_id)
                result = await db.execute(stmt)
                run = result.scalar_one_or_none()
                if run is not None:
                    run.status = status
                    run.stopped_at = datetime.now(timezone.utc)
                    run.current_stage_index = self._current_stage_index
                    run.current_stage_id = self.current_stage_id
                    run.loop_count = self._loop_count
                    run.total_actions_count = self.total_actions_count
                    run.character_states = self.character_states
                    run.stage_history = self._stage_history
                    if error_message:
                        run.error_message = error_message
                await db.commit()
        except Exception:
            logger.exception("Failed to finalize pipeline run %d", self._run_id)
