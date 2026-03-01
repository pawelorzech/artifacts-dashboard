"""Tests for BaseStrategy static helpers."""

from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import InventorySlot


class TestInventoryHelpers:
    """Tests for inventory-related static methods."""

    def test_inventory_used_slots_empty(self, make_character):
        char = make_character(inventory=[])
        assert BaseStrategy._inventory_used_slots(char) == 0

    def test_inventory_used_slots_with_items(self, make_character):
        items = [InventorySlot(slot=i, code=f"item_{i}", quantity=1) for i in range(5)]
        char = make_character(inventory=items)
        assert BaseStrategy._inventory_used_slots(char) == 5

    def test_inventory_free_slots_all_free(self, make_character):
        char = make_character(inventory_max_items=20, inventory=[])
        assert BaseStrategy._inventory_free_slots(char) == 20

    def test_inventory_free_slots_partially_used(self, make_character):
        items = [InventorySlot(slot=i, code=f"item_{i}", quantity=1) for i in range(8)]
        char = make_character(inventory_max_items=20, inventory=items)
        assert BaseStrategy._inventory_free_slots(char) == 12

    def test_inventory_free_slots_full(self, make_character):
        items = [InventorySlot(slot=i, code=f"item_{i}", quantity=1) for i in range(20)]
        char = make_character(inventory_max_items=20, inventory=items)
        assert BaseStrategy._inventory_free_slots(char) == 0


class TestHpPercent:
    """Tests for HP percentage calculation."""

    def test_full_health(self, make_character):
        char = make_character(hp=100, max_hp=100)
        assert BaseStrategy._hp_percent(char) == 100.0

    def test_half_health(self, make_character):
        char = make_character(hp=50, max_hp=100)
        assert BaseStrategy._hp_percent(char) == 50.0

    def test_zero_health(self, make_character):
        char = make_character(hp=0, max_hp=100)
        assert BaseStrategy._hp_percent(char) == 0.0

    def test_zero_max_hp_returns_100(self, make_character):
        char = make_character(hp=0, max_hp=0)
        assert BaseStrategy._hp_percent(char) == 100.0


class TestIsAt:
    """Tests for position checking."""

    def test_at_position(self, make_character):
        char = make_character(x=5, y=10)
        assert BaseStrategy._is_at(char, 5, 10) is True

    def test_not_at_position(self, make_character):
        char = make_character(x=5, y=10)
        assert BaseStrategy._is_at(char, 0, 0) is False

    def test_wrong_x_only(self, make_character):
        char = make_character(x=5, y=10)
        assert BaseStrategy._is_at(char, 6, 10) is False

    def test_wrong_y_only(self, make_character):
        char = make_character(x=5, y=10)
        assert BaseStrategy._is_at(char, 5, 11) is False


class TestActionPlan:
    """Tests for ActionPlan dataclass."""

    def test_create_with_defaults(self):
        plan = ActionPlan(ActionType.MOVE)
        assert plan.action_type == ActionType.MOVE
        assert plan.params == {}
        assert plan.reason == ""

    def test_create_with_params(self):
        plan = ActionPlan(
            ActionType.MOVE,
            params={"x": 5, "y": 10},
            reason="Moving to target",
        )
        assert plan.params == {"x": 5, "y": 10}
        assert plan.reason == "Moving to target"


class TestActionType:
    """Tests for ActionType enum values."""

    def test_all_action_types_exist(self):
        expected = {
            "move", "fight", "gather", "rest", "equip", "unequip",
            "use_item", "deposit_item", "withdraw_item", "craft", "recycle",
            "ge_buy", "ge_create_buy", "ge_sell", "ge_fill", "ge_cancel",
            "task_new", "task_trade", "task_complete", "task_exchange", "task_cancel",
            "deposit_gold", "withdraw_gold", "npc_buy", "npc_sell",
            "idle", "complete",
        }
        actual = {at.value for at in ActionType}
        assert actual == expected

    def test_action_type_is_string(self):
        assert isinstance(ActionType.MOVE.value, str)
        assert ActionType.MOVE == "move"
