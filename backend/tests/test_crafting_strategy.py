"""Tests for the CraftingStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.crafting import CraftingStrategy
from app.schemas.game import CraftItem, CraftSchema, EffectSchema, InventorySlot, ItemSchema


def _make_craftable_item(
    code: str = "iron_sword",
    skill: str = "weaponcrafting",
    level: int = 5,
    materials: list[tuple[str, int]] | None = None,
) -> ItemSchema:
    """Helper to build an ItemSchema with a crafting recipe."""
    if materials is None:
        materials = [("iron_ore", 5), ("wood", 2)]
    return ItemSchema(
        name=code.replace("_", " ").title(),
        code=code,
        level=level,
        type="weapon",
        craft=CraftSchema(
            skill=skill,
            level=level,
            items=[CraftItem(code=c, quantity=q) for c, q in materials],
        ),
    )


class TestCraftingStrategyInitialization:
    """Tests for CraftingStrategy creation and recipe resolution."""

    def test_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf)
        assert strategy.get_state() == "check_materials"

    def test_recipe_resolved_from_items_data(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        item = _make_craftable_item()
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])

        assert strategy._recipe_resolved is True
        assert len(strategy._recipe) == 2
        assert strategy._craft_skill == "weaponcrafting"

    def test_recipe_not_resolved_without_data(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf)

        assert strategy._recipe_resolved is False

    def test_set_items_data_resolves_recipe(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf)
        item = _make_craftable_item()
        strategy.set_items_data([item])

        assert strategy._recipe_resolved is True

    def test_set_items_data_no_double_resolve(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        item = _make_craftable_item()
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        # Calling again should not re-resolve
        strategy._craft_skill = "overwritten"
        strategy.set_items_data([item])
        assert strategy._craft_skill == "overwritten"


class TestCraftingStrategyIdleWithoutRecipe:
    """Tests for behavior when recipe is not resolved."""

    @pytest.mark.asyncio
    async def test_idle_when_recipe_not_resolved(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf)
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE


class TestCraftingStrategyMaterials:
    """Tests for material checking and withdrawal."""

    @pytest.mark.asyncio
    async def test_move_to_bank_when_materials_missing(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(x=0, y=0, inventory=[])

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}

    @pytest.mark.asyncio
    async def test_withdraw_materials_at_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(x=10, y=0, inventory=[])

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.WITHDRAW_ITEM
        assert plan.params["code"] == "iron_ore"
        assert plan.params["quantity"] == 3

    @pytest.mark.asyncio
    async def test_partial_materials_withdraw_remaining(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 5)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        # Character already has 2 iron_ore
        char = make_character(
            x=10, y=0,
            inventory=[InventorySlot(slot=0, code="iron_ore", quantity=2)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.WITHDRAW_ITEM
        assert plan.params["code"] == "iron_ore"
        assert plan.params["quantity"] == 3  # Need 5, have 2, withdraw 3


class TestCraftingStrategyCrafting:
    """Tests for the crafting execution flow."""

    @pytest.mark.asyncio
    async def test_move_to_workshop_with_all_materials(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(
            x=0, y=0,
            inventory=[InventorySlot(slot=0, code="iron_ore", quantity=3)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 5, "y": 5}

    @pytest.mark.asyncio
    async def test_craft_when_at_workshop_with_materials(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(
            x=5, y=5,
            inventory=[InventorySlot(slot=0, code="iron_ore", quantity=3)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.CRAFT
        assert plan.params["code"] == "iron_sword"

    @pytest.mark.asyncio
    async def test_complete_after_crafting_quantity(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy(
            {"item_code": "iron_sword", "quantity": 1},
            pf,
            items_data=[item],
        )
        # Simulate having crafted enough
        strategy._crafted_count = 1

        char = make_character(x=5, y=5)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE


class TestCraftingStrategyRecycle:
    """Tests for recycle_excess behavior."""

    @pytest.mark.asyncio
    async def test_recycle_after_craft(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy(
            {"item_code": "iron_sword", "quantity": 10, "recycle_excess": True},
            pf,
            items_data=[item],
        )
        # Simulate: at workshop, just crafted, now checking result
        strategy._state = strategy._state.__class__("check_result")
        char = make_character(
            x=5, y=5,
            inventory=[InventorySlot(slot=0, code="iron_sword", quantity=1)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.RECYCLE
        assert plan.params["code"] == "iron_sword"


class TestCraftingStrategyDeposit:
    """Tests for deposit behavior after crafting."""

    @pytest.mark.asyncio
    async def test_deposit_after_completing_all_crafts(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy(
            {"item_code": "iron_sword", "quantity": 1},
            pf,
            items_data=[item],
        )
        # Simulate: just crafted the last item
        strategy._state = strategy._state.__class__("check_result")
        strategy._crafted_count = 0  # Will be incremented in handler

        char = make_character(
            x=5, y=5,
            inventory=[InventorySlot(slot=0, code="iron_sword", quantity=1)],
        )

        plan = await strategy.next_action(char)
        # After crafting 1/1, should move to bank to deposit
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}

    @pytest.mark.asyncio
    async def test_deposit_items_at_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy(
            {"item_code": "iron_sword", "quantity": 5},  # quantity > crafted
            pf,
            items_data=[item],
        )
        strategy._state = strategy._state.__class__("deposit")
        strategy._crafted_count = 2  # Still more to craft

        char = make_character(
            x=10, y=0,
            inventory=[InventorySlot(slot=0, code="iron_sword", quantity=2)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.DEPOSIT_ITEM
        assert plan.params["code"] == "iron_sword"

    @pytest.mark.asyncio
    async def test_complete_after_all_deposited(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy(
            {"item_code": "iron_sword", "quantity": 1},
            pf,
            items_data=[item],
        )
        strategy._state = strategy._state.__class__("deposit")
        strategy._crafted_count = 1  # Already crafted target quantity

        char = make_character(
            x=10, y=0,
            inventory=[InventorySlot(slot=0, code="iron_sword", quantity=1)],
        )

        plan = await strategy.next_action(char)
        # With crafted_count >= quantity, the top-level check returns COMPLETE
        assert plan.action_type == ActionType.COMPLETE


class TestCraftingStrategyNoLocations:
    """Tests for missing map tiles."""

    @pytest.mark.asyncio
    async def test_idle_when_no_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (5, 5, "workshop", "weaponcrafting"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(x=0, y=0, inventory=[])

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE

    @pytest.mark.asyncio
    async def test_idle_when_no_workshop(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
        ])
        item = _make_craftable_item(materials=[("iron_ore", 3)])
        strategy = CraftingStrategy({"item_code": "iron_sword"}, pf, items_data=[item])
        char = make_character(
            x=0, y=0,
            inventory=[InventorySlot(slot=0, code="iron_ore", quantity=3)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE
