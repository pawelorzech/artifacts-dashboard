"""Tests for the TradingStrategy state machine."""

import pytest

from app.engine.strategies.base import ActionType
from app.engine.strategies.trading import TradingStrategy
from app.schemas.game import InventorySlot


class TestTradingStrategyInitialization:
    """Tests for TradingStrategy creation and initial state."""

    def test_sell_loot_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        assert "sell_loot" in strategy.get_state()
        assert "move_to_bank" in strategy.get_state()

    def test_buy_materials_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "grand_exchange", "grand_exchange")])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "buy_materials"}, pf
        )
        assert "buy_materials" in strategy.get_state()
        assert "move_to_ge" in strategy.get_state()

    def test_flip_initial_state(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "grand_exchange", "grand_exchange")])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "flip"}, pf
        )
        assert "flip" in strategy.get_state()
        assert "move_to_ge" in strategy.get_state()

    def test_unknown_mode_defaults_to_sell_loot(self, pathfinder_with_maps):
        pf = pathfinder_with_maps([(0, 0, "bank", "bank")])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "invalid_mode"}, pf
        )
        assert "sell_loot" in strategy.get_state()


class TestTradingStrategySellLoot:
    """Tests for the sell_loot mode."""

    @pytest.mark.asyncio
    async def test_move_to_bank_first(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 5}, pf
        )
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 10, "y": 0}

    @pytest.mark.asyncio
    async def test_withdraw_at_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 5}, pf
        )
        char = make_character(x=10, y=0, inventory_max_items=20)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.WITHDRAW_ITEM
        assert plan.params["code"] == "iron_ore"
        assert plan.params["quantity"] == 5

    @pytest.mark.asyncio
    async def test_withdraw_limited_by_free_slots(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 100}, pf
        )
        # Only 3 free slots
        items = [InventorySlot(slot=i, code="junk", quantity=1) for i in range(17)]
        char = make_character(x=10, y=0, inventory_max_items=20, inventory=items)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.WITHDRAW_ITEM
        assert plan.params["quantity"] == 3  # min(100, 3 free slots)

    @pytest.mark.asyncio
    async def test_move_to_ge_after_withdraw(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 5}, pf
        )
        # Simulate: withdrew everything
        strategy._items_withdrawn = 5
        strategy._state = strategy._state.__class__("withdraw_items")

        char = make_character(x=10, y=0, inventory_max_items=20)
        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 20, "y": 0}

    @pytest.mark.asyncio
    async def test_create_sell_order_at_ge(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 5, "min_price": 10},
            pf,
        )
        strategy._state = strategy._state.__class__("create_sell_order")
        char = make_character(
            x=20, y=0,
            inventory=[InventorySlot(slot=0, code="iron_ore", quantity=5)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.GE_SELL
        assert plan.params["code"] == "iron_ore"
        assert plan.params["quantity"] == 5
        assert plan.params["price"] == 10

    @pytest.mark.asyncio
    async def test_complete_when_no_items_to_sell(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot", "quantity": 5}, pf
        )
        strategy._state = strategy._state.__class__("create_sell_order")
        char = make_character(x=20, y=0, inventory=[])

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE


class TestTradingStrategyBuyMaterials:
    """Tests for the buy_materials mode."""

    @pytest.mark.asyncio
    async def test_move_to_ge_first(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "buy_materials", "quantity": 10}, pf
        )
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {"x": 20, "y": 0}

    @pytest.mark.asyncio
    async def test_create_buy_order_at_ge(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "buy_materials", "quantity": 10, "max_price": 50},
            pf,
        )
        char = make_character(x=20, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.GE_BUY
        assert plan.params["code"] == "iron_ore"
        assert plan.params["quantity"] == 10
        assert plan.params["price"] == 50


class TestTradingStrategyWaiting:
    """Tests for the order waiting logic."""

    @pytest.mark.asyncio
    async def test_idle_while_waiting(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        strategy._state = strategy._state.__class__("wait_for_order")
        strategy._wait_cycles = 0
        char = make_character(x=20, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE

    @pytest.mark.asyncio
    async def test_check_orders_after_wait(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        strategy._state = strategy._state.__class__("wait_for_order")
        strategy._wait_cycles = 3  # After 3 cycles, should check
        char = make_character(x=20, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE


class TestTradingStrategyNoLocations:
    """Tests for missing map tiles."""

    @pytest.mark.asyncio
    async def test_idle_when_no_bank(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE

    @pytest.mark.asyncio
    async def test_idle_when_no_ge(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "buy_materials"}, pf
        )
        char = make_character(x=0, y=0)

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.IDLE


class TestTradingStrategyDeposit:
    """Tests for the deposit_items state."""

    @pytest.mark.asyncio
    async def test_deposit_items(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        strategy._state = strategy._state.__class__("deposit_items")
        char = make_character(
            x=10, y=0,
            inventory=[InventorySlot(slot=0, code="gold_coins", quantity=100)],
        )

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.DEPOSIT_ITEM
        assert plan.params["code"] == "gold_coins"

    @pytest.mark.asyncio
    async def test_complete_after_all_deposited(self, make_character, pathfinder_with_maps):
        pf = pathfinder_with_maps([
            (10, 0, "bank", "bank"),
            (20, 0, "grand_exchange", "grand_exchange"),
        ])
        strategy = TradingStrategy(
            {"item_code": "iron_ore", "mode": "sell_loot"}, pf
        )
        strategy._state = strategy._state.__class__("deposit_items")
        char = make_character(x=10, y=0, inventory=[])

        plan = await strategy.next_action(char)
        assert plan.action_type == ActionType.COMPLETE
