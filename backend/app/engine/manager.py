from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.engine.cooldown import CooldownTracker
from app.engine.pathfinder import Pathfinder
from app.engine.runner import AutomationRunner
from app.engine.decision.equipment_optimizer import EquipmentOptimizer
from app.engine.decision.monster_selector import MonsterSelector
from app.engine.decision.resource_selector import ResourceSelector
from app.engine.strategies.base import BaseStrategy
from app.engine.strategies.combat import CombatStrategy
from app.engine.strategies.crafting import CraftingStrategy
from app.engine.strategies.gathering import GatheringStrategy
from app.engine.strategies.leveling import LevelingStrategy
from app.engine.strategies.task import TaskStrategy
from app.engine.strategies.trading import TradingStrategy
from app.engine.pipeline.coordinator import PipelineCoordinator
from app.engine.workflow.runner import WorkflowRunner
from app.models.automation import AutomationConfig, AutomationRun
from app.models.pipeline import PipelineConfig, PipelineRun
from app.models.workflow import WorkflowConfig, WorkflowRun
from app.schemas.automation import (
    AutomationRunResponse,
    AutomationStatusResponse,
)
from app.schemas.game import ItemSchema, MonsterSchema, ResourceSchema
from app.schemas.pipeline import (
    CharacterStateResponse,
    PipelineRunResponse,
    PipelineStatusResponse,
)
from app.schemas.workflow import WorkflowRunResponse, WorkflowStatusResponse
from app.services.artifacts_client import ArtifactsClient

if TYPE_CHECKING:
    from app.websocket.event_bus import EventBus

logger = logging.getLogger(__name__)


class AutomationManager:
    """Central manager that orchestrates all automation runners and workflow runners.

    One manager exists per application instance and is stored on
    ``app.state.automation_manager``. It holds references to all active
    runners (keyed by ``config_id``) and workflow runners (keyed by
    ``workflow_id``), and provides high-level start / stop / pause /
    resume operations.
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
        self._workflow_runners: dict[int, WorkflowRunner] = {}
        self._pipeline_coordinators: dict[int, PipelineCoordinator] = {}
        self._cooldown_tracker = CooldownTracker()

        # Lazy-loaded game data caches for smart strategies
        self._monsters_cache: list[MonsterSchema] | None = None
        self._resources_cache: list[ResourceSchema] | None = None
        self._items_cache: list[ItemSchema] | None = None

    # ------------------------------------------------------------------
    # Game data cache
    # ------------------------------------------------------------------

    async def _ensure_game_data(self) -> None:
        """Load game data caches lazily on first use."""
        if self._monsters_cache is None:
            try:
                raw = await self._client.get_all_monsters()
                self._monsters_cache = [MonsterSchema(**m) for m in raw]
            except Exception:
                logger.exception("Failed to load monsters cache")
                self._monsters_cache = []

        if self._resources_cache is None:
            try:
                raw = await self._client.get_all_resources()
                self._resources_cache = [ResourceSchema(**r) for r in raw]
            except Exception:
                logger.exception("Failed to load resources cache")
                self._resources_cache = []

        if self._items_cache is None:
            try:
                raw = await self._client.get_all_items()
                self._items_cache = [ItemSchema(**i) for i in raw]
            except Exception:
                logger.exception("Failed to load items cache")
                self._items_cache = []

    # ------------------------------------------------------------------
    # Character busy check
    # ------------------------------------------------------------------

    def is_character_busy(self, character_name: str) -> bool:
        """Return True if the character is running any automation, workflow, or pipeline."""
        for runner in self._runners.values():
            if runner.character_name == character_name and (runner.is_running or runner.is_paused):
                return True
        for wf_runner in self._workflow_runners.values():
            if wf_runner.character_name == character_name and (wf_runner.is_running or wf_runner.is_paused):
                return True
        for coord in self._pipeline_coordinators.values():
            if (coord.is_running or coord.is_paused) and character_name in coord.all_characters:
                return True
        return False

    # ------------------------------------------------------------------
    # Automation Lifecycle
    # ------------------------------------------------------------------

    async def start(self, config_id: int) -> AutomationRunResponse:
        """Start an automation from its persisted configuration."""
        if config_id in self._runners:
            runner = self._runners[config_id]
            if runner.is_running or runner.is_paused:
                raise ValueError(
                    f"Automation config {config_id} is already running "
                    f"(run_id={runner.run_id}, status={runner.status})"
                )

        async with self._db_factory() as db:
            config = await db.get(AutomationConfig, config_id)
            if config is None:
                raise ValueError(f"Automation config {config_id} not found")
            if not config.enabled:
                raise ValueError(f"Automation config {config_id} is disabled")

            # Check character busy
            if self.is_character_busy(config.character_name):
                raise ValueError(
                    f"Character {config.character_name!r} is already running an automation or workflow"
                )

            # Ensure game data is loaded for smart strategies
            await self._ensure_game_data()

            strategy = self._create_strategy(config.strategy_type, config.config)

            run = AutomationRun(
                config_id=config_id,
                status="running",
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

            run_response = AutomationRunResponse.model_validate(run)

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
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")
        await runner.stop()
        del self._runners[config_id]
        logger.info("Stopped automation config=%d", config_id)

    async def pause(self, config_id: int) -> None:
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")
        if not runner.is_running:
            raise ValueError(f"Runner for config {config_id} is not running (status={runner.status})")
        await runner.pause()

    async def resume(self, config_id: int) -> None:
        runner = self._runners.get(config_id)
        if runner is None:
            raise ValueError(f"No active runner for config {config_id}")
        if not runner.is_paused:
            raise ValueError(f"Runner for config {config_id} is not paused (status={runner.status})")
        await runner.resume()

    async def stop_all(self) -> None:
        """Stop all running automations, workflows, and pipelines (used during shutdown)."""
        config_ids = list(self._runners.keys())
        for config_id in config_ids:
            try:
                await self.stop(config_id)
            except Exception:
                logger.exception("Error stopping automation config=%d", config_id)

        workflow_ids = list(self._workflow_runners.keys())
        for wf_id in workflow_ids:
            try:
                await self.stop_workflow(wf_id)
            except Exception:
                logger.exception("Error stopping workflow=%d", wf_id)

        pipeline_ids = list(self._pipeline_coordinators.keys())
        for pid in pipeline_ids:
            try:
                await self.stop_pipeline(pid)
            except Exception:
                logger.exception("Error stopping pipeline=%d", pid)

    # ------------------------------------------------------------------
    # Automation Status queries
    # ------------------------------------------------------------------

    def get_status(self, config_id: int) -> AutomationStatusResponse | None:
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
        runner = self._runners.get(config_id)
        return runner is not None and (runner.is_running or runner.is_paused)

    # ------------------------------------------------------------------
    # Workflow Lifecycle
    # ------------------------------------------------------------------

    async def start_workflow(self, workflow_id: int) -> WorkflowRunResponse:
        """Start a workflow from its persisted configuration."""
        if workflow_id in self._workflow_runners:
            runner = self._workflow_runners[workflow_id]
            if runner.is_running or runner.is_paused:
                raise ValueError(
                    f"Workflow {workflow_id} is already running "
                    f"(run_id={runner.run_id}, status={runner.status})"
                )

        async with self._db_factory() as db:
            config = await db.get(WorkflowConfig, workflow_id)
            if config is None:
                raise ValueError(f"Workflow config {workflow_id} not found")
            if not config.enabled:
                raise ValueError(f"Workflow config {workflow_id} is disabled")
            if not config.steps:
                raise ValueError(f"Workflow config {workflow_id} has no steps")

            # Check character busy
            if self.is_character_busy(config.character_name):
                raise ValueError(
                    f"Character {config.character_name!r} is already running an automation or workflow"
                )

            # Ensure game data for smart strategies
            await self._ensure_game_data()

            # Create workflow run record
            run = WorkflowRun(
                workflow_id=workflow_id,
                status="running",
                current_step_index=0,
                current_step_id=config.steps[0].get("id", "") if config.steps else "",
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

            run_response = WorkflowRunResponse.model_validate(run)

        runner = WorkflowRunner(
            workflow_id=workflow_id,
            character_name=config.character_name,
            steps=config.steps,
            loop=config.loop,
            max_loops=config.max_loops,
            strategy_factory=self._create_strategy,
            client=self._client,
            cooldown_tracker=self._cooldown_tracker,
            db_factory=self._db_factory,
            run_id=run.id,
            event_bus=self._event_bus,
        )
        self._workflow_runners[workflow_id] = runner
        await runner.start()

        logger.info(
            "Started workflow=%d character=%s steps=%d run=%d",
            workflow_id,
            config.character_name,
            len(config.steps),
            run.id,
        )
        return run_response

    async def stop_workflow(self, workflow_id: int) -> None:
        runner = self._workflow_runners.get(workflow_id)
        if runner is None:
            raise ValueError(f"No active runner for workflow {workflow_id}")
        await runner.stop()
        del self._workflow_runners[workflow_id]
        logger.info("Stopped workflow=%d", workflow_id)

    async def pause_workflow(self, workflow_id: int) -> None:
        runner = self._workflow_runners.get(workflow_id)
        if runner is None:
            raise ValueError(f"No active runner for workflow {workflow_id}")
        if not runner.is_running:
            raise ValueError(f"Workflow runner {workflow_id} is not running (status={runner.status})")
        await runner.pause()

    async def resume_workflow(self, workflow_id: int) -> None:
        runner = self._workflow_runners.get(workflow_id)
        if runner is None:
            raise ValueError(f"No active runner for workflow {workflow_id}")
        if not runner.is_paused:
            raise ValueError(f"Workflow runner {workflow_id} is not paused (status={runner.status})")
        await runner.resume()

    # ------------------------------------------------------------------
    # Workflow Status queries
    # ------------------------------------------------------------------

    def get_workflow_status(self, workflow_id: int) -> WorkflowStatusResponse | None:
        runner = self._workflow_runners.get(workflow_id)
        if runner is None:
            return None
        return WorkflowStatusResponse(
            workflow_id=runner.workflow_id,
            character_name=runner.character_name,
            status=runner.status,
            run_id=runner.run_id,
            current_step_index=runner.current_step_index,
            current_step_id=runner.current_step_id,
            total_steps=len(runner._steps),
            loop_count=runner.loop_count,
            total_actions_count=runner.total_actions_count,
            step_actions_count=runner.step_actions_count,
            strategy_state=runner.strategy_state,
        )

    def get_all_workflow_statuses(self) -> list[WorkflowStatusResponse]:
        return [
            WorkflowStatusResponse(
                workflow_id=r.workflow_id,
                character_name=r.character_name,
                status=r.status,
                run_id=r.run_id,
                current_step_index=r.current_step_index,
                current_step_id=r.current_step_id,
                total_steps=len(r._steps),
                loop_count=r.loop_count,
                total_actions_count=r.total_actions_count,
                step_actions_count=r.step_actions_count,
                strategy_state=r.strategy_state,
            )
            for r in self._workflow_runners.values()
        ]

    def is_workflow_running(self, workflow_id: int) -> bool:
        runner = self._workflow_runners.get(workflow_id)
        return runner is not None and (runner.is_running or runner.is_paused)

    # ------------------------------------------------------------------
    # Pipeline Lifecycle
    # ------------------------------------------------------------------

    async def start_pipeline(self, pipeline_id: int) -> PipelineRunResponse:
        """Start a pipeline from its persisted configuration."""
        if pipeline_id in self._pipeline_coordinators:
            coord = self._pipeline_coordinators[pipeline_id]
            if coord.is_running or coord.is_paused:
                raise ValueError(
                    f"Pipeline {pipeline_id} is already running "
                    f"(run_id={coord.run_id}, status={coord.status})"
                )

        async with self._db_factory() as db:
            config = await db.get(PipelineConfig, pipeline_id)
            if config is None:
                raise ValueError(f"Pipeline config {pipeline_id} not found")
            if not config.enabled:
                raise ValueError(f"Pipeline config {pipeline_id} is disabled")
            if not config.stages:
                raise ValueError(f"Pipeline config {pipeline_id} has no stages")

            # Collect all characters and verify none are busy
            all_chars: set[str] = set()
            for stage in config.stages:
                for cs in stage.get("character_steps", []):
                    all_chars.add(cs["character_name"])

            busy = [c for c in all_chars if self.is_character_busy(c)]
            if busy:
                raise ValueError(
                    f"Characters already busy: {', '.join(sorted(busy))}"
                )

            # Ensure game data for strategies
            await self._ensure_game_data()

            run = PipelineRun(
                pipeline_id=pipeline_id,
                status="running",
                current_stage_index=0,
                current_stage_id=config.stages[0].get("id", "") if config.stages else "",
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

            run_response = PipelineRunResponse.model_validate(run)

        coord = PipelineCoordinator(
            pipeline_id=pipeline_id,
            stages=config.stages,
            loop=config.loop,
            max_loops=config.max_loops,
            strategy_factory=self._create_strategy,
            client=self._client,
            cooldown_tracker=self._cooldown_tracker,
            db_factory=self._db_factory,
            run_id=run.id,
            event_bus=self._event_bus,
        )
        self._pipeline_coordinators[pipeline_id] = coord
        await coord.start()

        logger.info(
            "Started pipeline=%d stages=%d characters=%s run=%d",
            pipeline_id,
            len(config.stages),
            sorted(all_chars),
            run.id,
        )
        return run_response

    async def stop_pipeline(self, pipeline_id: int) -> None:
        coord = self._pipeline_coordinators.get(pipeline_id)
        if coord is None:
            raise ValueError(f"No active coordinator for pipeline {pipeline_id}")
        await coord.stop()
        del self._pipeline_coordinators[pipeline_id]
        logger.info("Stopped pipeline=%d", pipeline_id)

    async def pause_pipeline(self, pipeline_id: int) -> None:
        coord = self._pipeline_coordinators.get(pipeline_id)
        if coord is None:
            raise ValueError(f"No active coordinator for pipeline {pipeline_id}")
        if not coord.is_running:
            raise ValueError(f"Pipeline {pipeline_id} is not running (status={coord.status})")
        await coord.pause()

    async def resume_pipeline(self, pipeline_id: int) -> None:
        coord = self._pipeline_coordinators.get(pipeline_id)
        if coord is None:
            raise ValueError(f"No active coordinator for pipeline {pipeline_id}")
        if not coord.is_paused:
            raise ValueError(f"Pipeline {pipeline_id} is not paused (status={coord.status})")
        await coord.resume()

    # ------------------------------------------------------------------
    # Pipeline Status queries
    # ------------------------------------------------------------------

    def get_pipeline_status(self, pipeline_id: int) -> PipelineStatusResponse | None:
        coord = self._pipeline_coordinators.get(pipeline_id)
        if coord is None:
            return None
        return PipelineStatusResponse(
            pipeline_id=coord.pipeline_id,
            status=coord.status,
            run_id=coord.run_id,
            current_stage_index=coord.current_stage_index,
            current_stage_id=coord.current_stage_id,
            total_stages=len(coord._stages),
            loop_count=coord.loop_count,
            total_actions_count=coord.total_actions_count,
            character_states=[
                CharacterStateResponse(
                    character_name=name,
                    status=state.get("status", "idle"),
                    step_id=state.get("step_id", ""),
                    actions_count=state.get("actions_count", 0),
                    strategy_state=state.get("strategy_state", ""),
                    error=state.get("error"),
                )
                for name, state in coord.character_states.items()
            ],
        )

    def get_all_pipeline_statuses(self) -> list[PipelineStatusResponse]:
        return [
            self.get_pipeline_status(pid)
            for pid in self._pipeline_coordinators
            if self.get_pipeline_status(pid) is not None
        ]

    def is_pipeline_running(self, pipeline_id: int) -> bool:
        coord = self._pipeline_coordinators.get(pipeline_id)
        return coord is not None and (coord.is_running or coord.is_paused)

    # ------------------------------------------------------------------
    # Strategy factory
    # ------------------------------------------------------------------

    def _create_strategy(self, strategy_type: str, config: dict) -> BaseStrategy:
        """Instantiate a strategy by type name, injecting game data and decision modules."""
        monster_selector = MonsterSelector()
        resource_selector = ResourceSelector()
        equipment_optimizer = EquipmentOptimizer()

        match strategy_type:
            case "combat":
                return CombatStrategy(
                    config,
                    self._pathfinder,
                    monster_selector=monster_selector,
                    monsters_data=self._monsters_cache,
                    equipment_optimizer=equipment_optimizer,
                    available_items=self._items_cache,
                )
            case "gathering":
                return GatheringStrategy(
                    config,
                    self._pathfinder,
                    resource_selector=resource_selector,
                    resources_data=self._resources_cache,
                )
            case "crafting":
                return CraftingStrategy(
                    config,
                    self._pathfinder,
                    items_data=self._items_cache,
                    resources_data=self._resources_cache,
                )
            case "trading":
                return TradingStrategy(
                    config,
                    self._pathfinder,
                    client=self._client,
                )
            case "task":
                return TaskStrategy(config, self._pathfinder)
            case "leveling":
                return LevelingStrategy(
                    config,
                    self._pathfinder,
                    resources_data=self._resources_cache,
                    monsters_data=self._monsters_cache,
                    resource_selector=resource_selector,
                    monster_selector=monster_selector,
                    equipment_optimizer=equipment_optimizer,
                    available_items=self._items_cache,
                )
            case _:
                raise ValueError(
                    f"Unknown strategy type: {strategy_type!r}. "
                    f"Supported: combat, gathering, crafting, trading, task, leveling"
                )
