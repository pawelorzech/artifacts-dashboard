"""Tests for the TaskStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.task import TaskStrategy
from app.schemas.game import InventorySlot


class TestTaskStrategyInitialization:
    """Tests for TaskStrategy creation."""

    def test_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "tasks_master", "tasks_master")])
        strategy = TaskStrategy({}, pf)
        assert strategy.get_state() == "move_to_taskmaster"

    def test_max_tasks_config(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "tasks_master", "tasks_master")])
        strategy = TaskStrategy({"max_tasks": 5}, pf)
        assert strategy._max_tasks == 5

    def test_auto_exchange_default(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "tasks_master", "tasks_master")])
        strategy = TaskStrategy({}, pf)
        assert strategy._auto_exchange is True


class TestTaskStrategyMovement:
    """Tests for movement to task master."""

    @pytest.mark.asyncio
    async def test_move_to_taskmaster(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 5, "y": 5}

    @pytest.mark.asyncio
    async def test_idle_when_no_taskmaster(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([(10, 0, "bank", "bank")])
        strategy = TaskStrategy({}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE

    @pytest.mark.asyncio
    async def test_skip_to_evaluate_when_has_task(self, make_character, pathfinder_with_maps):
        """If character already has a task, skip directly to evaluation."""
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=0, y=0,
            task="chicken",
            task_type="monsters",
            task_total=5,
            task_progress=0,
        )

        plan = await strategy.next_action(char)
        # Should move to the monster target, not to taskmaster
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 3, "y": 3}


class TestTaskStrategyAcceptTask:
    """Tests for accepting tasks."""

    @pytest.mark.asyncio
    async def test_accept_new_task_at_taskmaster(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(x=5, y=5)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.TASK_NEW

    @pytest.mark.asyncio
    async def test_evaluate_existing_task_instead_of_accept(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "monster", "wolf"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=5, y=5,
            task="wolf",
            task_type="monsters",
            task_total=3,
            task_progress=0,
        )

        plan = await strategy.next_action(char)
        # Should go to the monster, not accept a new task
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 3, "y": 3}


class TestTaskStrategyExecution:
    """Tests for task action execution."""

    @pytest.mark.asyncio
    async def test_fight_for_monster_task(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=3, y=3,
            hp=100, max_hp=100,
            task="chicken",
            task_type="monsters",
            task_total=5,
            task_progress=2,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.FIGHT

    @pytest.mark.asyncio
    async def test_gather_for_resource_task(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=3, y=3,
            inventory_max_items=20,
            task="copper_rocks",
            task_type="resources",
            task_total=10,
            task_progress=3,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.GATHER

    @pytest.mark.asyncio
    async def test_heal_when_low_hp_during_monster_task(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=3, y=3,
            hp=30, max_hp=100,
            task="chicken",
            task_type="monsters",
            task_total=5,
            task_progress=2,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.REST

    @pytest.mark.asyncio
    async def test_deposit_when_inventory_full(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        items = [InventorySlot(slot=i, code="copper_ore", quantity=1) for i in range(20)]
        char = make_character(
            x=3, y=3,
            inventory_max_items=20,
            inventory=items,
            task="copper_rocks",
            task_type="resources",
            task_total=30,
            task_progress=15,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}


class TestTaskStrategyCompletion:
    """Tests for task completion flow."""

    @pytest.mark.asyncio
    async def test_trade_when_task_complete(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        char = make_character(
            x=0, y=0,
            task="chicken",
            task_type="monsters",
            task_total=5,
            task_progress=5,  # Complete!
        )

        plan = await strategy.next_action(char)
        # Should move to taskmaster to trade
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 5, "y": 5}

    @pytest.mark.asyncio
    async def test_trade_items_at_taskmaster(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({}, pf)
        strategy._state = strategy._state.__class__("trade_items")
        strategy._current_task_code = "chicken"
        strategy._current_task_total = 5

        char = make_character(x=5, y=5)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.TASK_TRADE
        assert plan.params["code"] == "chicken"
        assert plan.params["quantity"] == 5

    @pytest.mark.asyncio
    async def test_complete_task_at_taskmaster(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({"auto_exchange": True}, pf)
        strategy._state = strategy._state.__class__("complete_task")
        strategy._current_task_code = "chicken"

        char = make_character(x=5, y=5)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.TASK_COMPLETE

    @pytest.mark.asyncio
    async def test_exchange_coins_after_complete(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({"auto_exchange": True}, pf)
        strategy._state = strategy._state.__class__("exchange_coins")

        char = make_character(x=5, y=5)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.TASK_EXCHANGE


class TestTaskStrategyMaxTasks:
    """Tests for max_tasks limit."""

    @pytest.mark.asyncio
    async def test_complete_when_max_tasks_reached(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({"max_tasks": 3}, pf)
        strategy._tasks_completed = 3

        char = make_character(x=5, y=5)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE

    @pytest.mark.asyncio
    async def test_continue_when_below_max_tasks(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({"max_tasks": 3}, pf)
        strategy._tasks_completed = 2

        char = make_character(x=0, y=0)
        plan = await strategy.next_action(char)
        assert plan.action_type != ActionType.COMPLETE

    @pytest.mark.asyncio
    async def test_no_limit_when_max_tasks_zero(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "tasks_master", "tasks_master"),
            (10, 0, "bank", "bank"),
        ])
        strategy = TaskStrategy({"max_tasks": 0}, pf)
        strategy._tasks_completed = 100

        char = make_character(x=0, y=0)
        plan = await strategy.next_action(char)
        assert plan.action_type != ActionType.COMPLETE
