"""Tests for the LevelingStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.leveling import LevelingStrategy
from app.schemas.game import InventorySlot, ResourceSchema


class TestLevelingStrategyInitialization:
    """Tests for LevelingStrategy creation."""

    def test_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({}, pf)
        assert strategy.get_state() == "evaluate"

    def test_target_skill_config(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({"target_skill": "mining"}, pf)
        assert strategy._target_skill == "mining"

    def test_max_level_config(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({"max_level": 30}, pf)
        assert strategy._max_level == 30


class TestLevelingStrategyEvaluation:
    """Tests for skill evaluation and target selection."""

    @pytest.mark.asyncio
    async def test_picks_target_skill_when_specified(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1)]
        strategy = LevelingStrategy(
            {"target_skill": "mining"}, pf, resources_data=resources
        )
        char = make_character(x=0, y=0, mining_level=5)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert strategy._chosen_skill == "mining"

    @pytest.mark.asyncio
    async def test_picks_lowest_skill_when_no_target(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "ash_tree"),
            (10, 0, "bank", "bank"),
        ])
        resources = [
            ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1),
            ResourceSchema(name="Ash Tree", code="ash_tree", skill="woodcutting", level=1),
            ResourceSchema(name="Gudgeon Spot", code="gudgeon_spot", skill="fishing", level=1),
        ]
        strategy = LevelingStrategy({}, pf, resources_data=resources)
        char = make_character(
            x=0, y=0,
            mining_level=10,
            woodcutting_level=3,  # lowest
            fishing_level=7,
        )

        plan = await strategy.next_action(char)
        assert strategy._chosen_skill == "woodcutting"

    @pytest.mark.asyncio
    async def test_complete_when_max_level_reached(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1)]
        strategy = LevelingStrategy(
            {"target_skill": "mining", "max_level": 10},
            pf,
            resources_data=resources,
        )
        char = make_character(x=0, y=0, mining_level=10)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE

    @pytest.mark.asyncio
    async def test_complete_when_no_skill_found(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
        ])
        strategy = LevelingStrategy({}, pf)
        # All skills at max_level with exclude set
        strategy._max_level = 5
        char = make_character(
            x=0, y=0,
            mining_level=999,
            woodcutting_level=999,
            fishing_level=999,
        )

        plan = await strategy.next_action(char)
        # Should complete since all skills are above max_level
        assert plan.action_type == ActionType.COMPLETE


class TestLevelingStrategyGathering:
    """Tests for gathering activity."""

    @pytest.mark.asyncio
    async def test_gather_at_resource(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1)]
        strategy = LevelingStrategy(
            {"target_skill": "mining"}, pf, resources_data=resources
        )
        char = make_character(
            x=3, y=3,
            mining_level=5,
            inventory_max_items=20,
        )

        # First call evaluates and moves; simulate being at target
        plan = await strategy.next_action(char)
        # Since we're at the target, should get GATHER
        assert plan.action_type == ActionType.GATHER

    @pytest.mark.asyncio
    async def test_deposit_when_inventory_full(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1)]
        strategy = LevelingStrategy(
            {"target_skill": "mining"}, pf, resources_data=resources
        )

        items = [InventorySlot(slot=i, code="copper_ore", quantity=1) for i in range(20)]
        char = make_character(
            x=3, y=3,
            mining_level=5,
            inventory_max_items=20,
            inventory=items,
        )

        plan = await strategy.next_action(char)
        # Should move to bank
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}


class TestLevelingStrategyCombat:
    """Tests for combat leveling."""

    @pytest.mark.asyncio
    async def test_fight_for_combat_leveling(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = LevelingStrategy({"target_skill": "combat"}, pf)
        char = make_character(
            x=3, y=3,
            hp=100, max_hp=100,
            level=5,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.FIGHT

    @pytest.mark.asyncio
    async def test_heal_during_combat(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "monster", "chicken"),
            (10, 0, "bank", "bank"),
        ])
        strategy = LevelingStrategy({"target_skill": "combat"}, pf)
        # Simulate: at monster, fighting, low HP
        strategy._state = strategy._state.__class__("fight")
        strategy._chosen_monster_code = "chicken"
        strategy._target_pos = (3, 3)

        char = make_character(
            x=3, y=3,
            hp=30, max_hp=100,
            level=5,
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.REST


class TestLevelingStrategyCraftingSkills:
    """Tests for crafting skill leveling via gathering."""

    @pytest.mark.asyncio
    async def test_crafting_skill_mapped_to_gathering(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [
            ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1),
        ]
        strategy = LevelingStrategy(
            {"target_skill": "weaponcrafting"}, pf, resources_data=resources
        )
        char = make_character(
            x=0, y=0,
            mining_level=5,
            weaponcrafting_level=3,
            inventory_max_items=20,
        )

        plan = await strategy.next_action(char)
        # Weaponcrafting maps to mining, so should find mining resource
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 3, "y": 3}

    def test_crafting_to_gathering_mapping(self):
        """Verify all crafting skills map to gathering skills."""
        assert LevelingStrategy._crafting_to_gathering("weaponcrafting") == "mining"
        assert LevelingStrategy._crafting_to_gathering("gearcrafting") == "mining"
        assert LevelingStrategy._crafting_to_gathering("jewelrycrafting") == "mining"
        assert LevelingStrategy._crafting_to_gathering("cooking") == "fishing"
        assert LevelingStrategy._crafting_to_gathering("alchemy") == "mining"
        assert LevelingStrategy._crafting_to_gathering("unknown") == ""


class TestLevelingStrategyResourceSelection:
    """Tests for resource target selection based on skill level."""

    @pytest.mark.asyncio
    async def test_prefers_higher_level_resource_within_range(
        self, make_character, pathfinder_with_maps
    ):
        pf = pathfinder_with_maps([
            (1, 1, "resource", "copper_rocks"),
            (2, 2, "resource", "iron_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [
            ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1),
            ResourceSchema(name="Iron Rocks", code="iron_rocks", skill="mining", level=6),
        ]
        strategy = LevelingStrategy(
            {"target_skill": "mining"}, pf, resources_data=resources
        )
        char = make_character(
            x=0, y=0,
            mining_level=5,
            inventory_max_items=20,
        )

        await strategy.next_action(char)
        # Should prefer iron_rocks (level 6, within +3 of skill level 5)
        assert strategy._chosen_resource_code == "iron_rocks"

    @pytest.mark.asyncio
    async def test_set_resources_data(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({}, pf)
        assert strategy._resources_data == []

        resources = [
            ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1),
        ]
        strategy.set_resources_data(resources)
        assert len(strategy._resources_data) == 1


class TestLevelingStrategyDeposit:
    """Tests for deposit behavior."""

    @pytest.mark.asyncio
    async def test_deposit_items_at_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        strategy = LevelingStrategy({"target_skill": "mining"}, pf)
        strategy._state = strategy._state.__class__("deposit")
        strategy._chosen_skill = "mining"
        strategy._target_pos = (3, 3)

        char = make_character(
            x=10, y=0,
            mining_level=5,
            inventory=[InventorySlot(slot=0, code="copper_ore", quantity=10)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.DEPOSIT_ITEM
        assert plan.params["code"] == "copper_ore"

    @pytest.mark.asyncio
    async def test_re_evaluate_after_deposit(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (3, 3, "resource", "copper_rocks"),
            (10, 0, "bank", "bank"),
        ])
        resources = [ResourceSchema(name="Copper Rocks", code="copper_rocks", skill="mining", level=1)]
        strategy = LevelingStrategy(
            {"target_skill": "mining"}, pf, resources_data=resources
        )
        strategy._state = strategy._state.__class__("deposit")
        strategy._chosen_skill = "mining"

        char = make_character(
            x=10, y=0,
            mining_level=5,
            inventory=[],
            inventory_max_items=20,
        )

        plan = await strategy.next_action(char)
        # Empty inventory triggers re-evaluation -> move to target
        assert plan.action_type == ActionType.MOVE


class TestLevelingStrategyGetState:
    """Tests for state reporting."""

    def test_state_with_chosen_skill(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({}, pf)
        strategy._chosen_skill = "mining"
        assert "mining" in strategy.get_state()

    def test_state_without_chosen_skill(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "resource", "copper_rocks")])
        strategy = LevelingStrategy({}, pf)
        assert strategy.get_state() == "evaluate"
