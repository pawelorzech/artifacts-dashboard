"""Tests for the GatheringStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.gathering import GatheringStrategy
from app.schemas.game import InventorySlot


class TestGatheringStrategyMovement:
    """Tests for movement to resource tiles."""

    @pytest.mark.asyncio
    async def test_move_to_resource(self, make_character, pathfinder_with_maps):
        """When not at resource location, the strategy should return MOVE."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy({"resource_code": "copper_rocks"}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 3, "y": 4}

    @pytest.mark.asyncio
    async def test_idle_when_no_resource_found(self, make_character, pathfinder_with_maps):
        """When no matching resource tile exists, the strategy should IDLE."""
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy({"resource_code": "gold_rocks"}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.IDLE


class TestGatheringStrategyGathering:
    """Tests for gathering behavior at the resource tile."""

    @pytest.mark.asyncio
    async def test_gather_when_at_resource(self, make_character, pathfinder_with_maps):
        """When at resource and inventory has space, the strategy should GATHER."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy({"resource_code": "copper_rocks"}, pf)
        char = make_character(x=3, y=4, inventory_max_items=20, inventory=[])

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.GATHER

    @pytest.mark.asyncio
    async def test_gather_when_inventory_has_some_items(self, make_character, pathfinder_with_maps):
        """Gathering should continue as long as inventory is not completely full."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy({"resource_code": "copper_rocks"}, pf)
        items = [InventorySlot(slot=0, code="copper_ore", quantity=5)]
        char = make_character(x=3, y=4, inventory_max_items=20, inventory=items)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.GATHER


class TestGatheringStrategyDeposit:
    """Tests for deposit behavior when inventory is full."""

    @pytest.mark.asyncio
    async def test_deposit_when_full(self, make_character, pathfinder_with_maps):
        """When inventory is full and deposit_on_full is True, move to bank."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "deposit_on_full": True},
            pf,
        )
        items = [InventorySlot(slot=i, code="copper_ore", quantity=1) for i in range(20)]
        char = make_character(x=3, y=4, inventory_max_items=20, inventory=items)

        plan = await strategy.next_action(char)

        # When at resource with full inventory, the gather handler detects full inventory
        # and transitions to check_inventory -> move_to_bank -> MOVE
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}

    @pytest.mark.asyncio
    async def test_deposit_items_at_bank(self, make_character, pathfinder_with_maps):
        """When at bank with items, the strategy should DEPOSIT_ITEM."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "deposit_on_full": True},
            pf,
        )
        items = [InventorySlot(slot=i, code="copper_ore", quantity=1) for i in range(20)]

        # First, move to bank
        char_full = make_character(x=3, y=4, inventory_max_items=20, inventory=items)
        await strategy.next_action(char_full)  # MOVE to bank

        # Now at bank
        char_at_bank = make_character(x=10, y=0, inventory_max_items=20, inventory=items)
        plan = await strategy.next_action(char_at_bank)

        assert plan.action_type == ActionType.DEPOSIT_ITEM
        assert plan.params["code"] == "copper_ore"

    @pytest.mark.asyncio
    async def test_complete_when_full_no_deposit(self, make_character, pathfinder_with_maps):
        """When inventory is full and deposit_on_full is False, COMPLETE."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "deposit_on_full": False},
            pf,
        )
        items = [InventorySlot(slot=i, code="copper_ore", quantity=1) for i in range(20)]
        char = make_character(x=3, y=4, inventory_max_items=20, inventory=items)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.COMPLETE


class TestGatheringStrategyMaxLoops:
    """Tests for the max_loops limit."""

    @pytest.mark.asyncio
    async def test_max_loops(self, make_character, pathfinder_with_maps):
        """Strategy should return COMPLETE after max_loops deposit cycles."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "max_loops": 1},
            pf,
        )

        # Simulate a complete gather-deposit cycle to increment _loop_count
        strategy._loop_count = 1  # Simulate one completed cycle

        char = make_character(x=3, y=4)
        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.COMPLETE

    @pytest.mark.asyncio
    async def test_no_max_loops(self, make_character, pathfinder_with_maps):
        """With max_loops=0 (default), the strategy should never COMPLETE due to loops."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "max_loops": 0},
            pf,
        )

        # Even with many loops completed, max_loops=0 means infinite
        strategy._loop_count = 999

        char = make_character(x=3, y=4)
        plan = await strategy.next_action(char)

        # Should still gather, not COMPLETE
        assert plan.action_type != ActionType.COMPLETE

    @pytest.mark.asyncio
    async def test_loop_count_increments_after_deposit(self, make_character, pathfinder_with_maps):
        """The loop counter should increment after depositing all items."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = GatheringStrategy(
            {"resource_code": "copper_rocks", "max_loops": 5},
            pf,
        )

        assert strategy._loop_count == 0

        # Simulate being at bank with empty inventory (all items deposited)
        # and in DEPOSIT state
        strategy._state = strategy._state.__class__("deposit")
        strategy._resource_pos = (3, 4)
        strategy._bank_pos = (10, 0)

        char = make_character(x=10, y=0, inventory=[])
        await strategy.next_action(char)

        assert strategy._loop_count == 1


class TestGatheringStrategyGetState:
    """Tests for get_state() reporting."""

    def test_initial_state(self, pathfinder_with_maps):
        """Initial state should be move_to_resource."""
        pf = pathfinder_with_maps([
            (3, 4, "resource", "copper_rocks"),
        ])
        strategy = GatheringStrategy({"resource_code": "copper_rocks"}, pf)
        assert strategy.get_state() == "move_to_resource"
