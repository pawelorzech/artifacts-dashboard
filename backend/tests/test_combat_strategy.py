"""Tests for the CombatStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.combat import CombatStrategy
from app.schemas.game import InventorySlot


class TestCombatStrategyMovement:
    """Tests for movement-related transitions."""

    @pytest.mark.asyncio
    async def test_move_to_monster(self, make_character, pathfinder_with_maps):
        """When not at monster location, the strategy should return MOVE."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy({"monster_code": "chicken"}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 5, "y": 5}

    @pytest.mark.asyncio
    async def test_idle_when_no_monster_found(self, make_character, pathfinder_with_maps):
        """When no matching monster tile exists, the strategy should IDLE."""
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy({"monster_code": "dragon"}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.IDLE


class TestCombatStrategyFighting:
    """Tests for combat behavior at the monster tile."""

    @pytest.mark.asyncio
    async def test_fight_when_at_monster(self, make_character, pathfinder_with_maps):
        """When at monster and healthy, the strategy should return FIGHT."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy({"monster_code": "chicken"}, pf)
        char = make_character(x=5, y=5, hp=100, max_hp=100)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.FIGHT

    @pytest.mark.asyncio
    async def test_fight_transitions_to_check_health(self, make_character, pathfinder_with_maps):
        """After returning FIGHT, the internal state should advance to CHECK_HEALTH."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy({"monster_code": "chicken"}, pf)
        char = make_character(x=5, y=5, hp=100, max_hp=100)

        await strategy.next_action(char)

        assert strategy.get_state() == "check_health"


class TestCombatStrategyHealing:
    """Tests for healing behavior."""

    @pytest.mark.asyncio
    async def test_heal_when_low_hp(self, make_character, pathfinder_with_maps):
        """When HP is below threshold, the strategy should return REST."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {"monster_code": "chicken", "auto_heal_threshold": 50},
            pf,
        )
        char = make_character(x=5, y=5, hp=30, max_hp=100)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.REST

    @pytest.mark.asyncio
    async def test_heal_with_consumable(self, make_character, pathfinder_with_maps):
        """When heal_method is consumable and character has the item, USE_ITEM is returned."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {
                "monster_code": "chicken",
                "auto_heal_threshold": 50,
                "heal_method": "consumable",
                "consumable_code": "cooked_chicken",
            },
            pf,
        )
        char = make_character(
            x=5,
            y=5,
            hp=30,
            max_hp=100,
            inventory=[InventorySlot(slot=0, code="cooked_chicken", quantity=5)],
        )

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.USE_ITEM
        assert plan.params["code"] == "cooked_chicken"

    @pytest.mark.asyncio
    async def test_heal_consumable_fallback_to_rest(self, make_character, pathfinder_with_maps):
        """When heal_method is consumable but character lacks the item, fallback to REST."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {
                "monster_code": "chicken",
                "auto_heal_threshold": 50,
                "heal_method": "consumable",
                "consumable_code": "cooked_chicken",
            },
            pf,
        )
        char = make_character(x=5, y=5, hp=30, max_hp=100, inventory=[])

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.REST

    @pytest.mark.asyncio
    async def test_no_heal_at_threshold(self, make_character, pathfinder_with_maps):
        """When HP is exactly at threshold, the strategy should FIGHT (not heal)."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {"monster_code": "chicken", "auto_heal_threshold": 50},
            pf,
        )
        # HP at exactly 50%
        char = make_character(x=5, y=5, hp=50, max_hp=100)

        plan = await strategy.next_action(char)

        assert plan.action_type == ActionType.FIGHT


class TestCombatStrategyDeposit:
    """Tests for inventory deposit behavior."""

    @pytest.mark.asyncio
    async def test_deposit_when_inventory_full(self, make_character, pathfinder_with_maps):
        """When inventory is nearly full, the strategy should move to bank and deposit."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {"monster_code": "chicken", "min_inventory_slots": 3},
            pf,
        )

        # Fill inventory: 20 max, with 18 slots used => 2 free < 3 min
        items = [InventorySlot(slot=i, code=f"loot_{i}", quantity=1) for i in range(18)]
        char = make_character(
            x=5, y=5,
            hp=100, max_hp=100,
            inventory_max_items=20,
            inventory=items,
        )

        # First call: at monster, healthy, so it will FIGHT
        plan1 = await strategy.next_action(char)
        assert plan1.action_type == ActionType.FIGHT

        # After fight, the state goes to CHECK_HEALTH. Simulate post-fight:
        # healthy + low inventory => should move to bank
        plan2 = await strategy.next_action(char)
        assert plan2.action_type == ActionType.MOVE
        assert plan2.params == {"x": 10, "y": 0}

    @pytest.mark.asyncio
    async def test_deposit_items_at_bank(self, make_character, pathfinder_with_maps):
        """When at bank with items, the strategy should DEPOSIT_ITEM."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = CombatStrategy(
            {"monster_code": "chicken", "min_inventory_slots": 3},
            pf,
        )

        items = [InventorySlot(slot=i, code=f"loot_{i}", quantity=1) for i in range(18)]
        char = make_character(
            x=5, y=5,
            hp=100, max_hp=100,
            inventory_max_items=20,
            inventory=items,
        )

        # Fight -> check_health -> check_inventory -> move_to_bank
        await strategy.next_action(char)  # FIGHT
        await strategy.next_action(char)  # MOVE to bank

        # Now simulate being at the bank
        char_at_bank = make_character(
            x=10, y=0,
            hp=100, max_hp=100,
            inventory_max_items=20,
            inventory=items,
        )

        plan = await strategy.next_action(char_at_bank)
        assert plan.action_type == ActionType.DEPOSIT_ITEM
        assert plan.params["code"] == "loot_0"

    @pytest.mark.asyncio
    async def test_no_deposit_when_disabled(self, make_character, pathfinder_with_maps):
        """When deposit_loot=False, full inventory should not trigger deposit."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
        ])
        strategy = CombatStrategy(
            {"monster_code": "chicken", "deposit_loot": False},
            pf,
        )

        items = [InventorySlot(slot=i, code=f"loot_{i}", quantity=1) for i in range(20)]
        char = make_character(
            x=5, y=5,
            hp=100, max_hp=100,
            inventory_max_items=20,
            inventory=items,
        )

        # Should fight and then loop back to fight (no bank trip)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.FIGHT


class TestCombatStrategyGetState:
    """Tests for get_state() reporting."""

    def test_initial_state(self, pathfinder_with_maps):
        """Initial state should be move_to_monster."""
        pf = pathfinder_with_maps([
            (5, 5, "monster", "chicken"),
        ])
        strategy = CombatStrategy({"monster_code": "chicken"}, pf)
        assert strategy.get_state() == "move_to_monster"
