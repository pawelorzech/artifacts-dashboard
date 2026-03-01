"""Tests for HealPolicy."""

from app.engine.decision.heal_policy import HealPolicy
from app.engine.strategies.base import ActionType
from app.schemas.game import InventorySlot


class TestHealPolicyShouldHeal:
    """Tests for HealPolicy.should_heal()."""

    def test_should_heal_low_hp(self, make_character):
        """Returns True when HP is below the threshold percentage."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100)

        assert policy.should_heal(char, threshold=50) is True

    def test_should_not_heal_full(self, make_character):
        """Returns False when character is at full HP."""
        policy = HealPolicy()
        char = make_character(hp=100, max_hp=100)

        assert policy.should_heal(char, threshold=50) is False

    def test_should_not_heal_above_threshold(self, make_character):
        """Returns False when HP is above threshold."""
        policy = HealPolicy()
        char = make_character(hp=80, max_hp=100)

        assert policy.should_heal(char, threshold=50) is False

    def test_should_heal_exactly_at_threshold(self, make_character):
        """Returns False when HP is exactly at threshold (not strictly below)."""
        policy = HealPolicy()
        char = make_character(hp=50, max_hp=100)

        # 50/100 = 50%, threshold=50 => 50 < 50 is False
        assert policy.should_heal(char, threshold=50) is False

    def test_should_heal_one_below_threshold(self, make_character):
        """Returns True when HP is just 1 below the threshold."""
        policy = HealPolicy()
        char = make_character(hp=49, max_hp=100)

        assert policy.should_heal(char, threshold=50) is True

    def test_should_heal_zero_hp(self, make_character):
        """Returns True when HP is zero."""
        policy = HealPolicy()
        char = make_character(hp=0, max_hp=100)

        assert policy.should_heal(char, threshold=50) is True

    def test_should_heal_zero_max_hp(self, make_character):
        """Returns False when max_hp is 0 to avoid division by zero."""
        policy = HealPolicy()
        char = make_character(hp=0, max_hp=0)

        assert policy.should_heal(char, threshold=50) is False

    def test_should_heal_high_threshold(self, make_character):
        """With a threshold of 100, any missing HP triggers healing."""
        policy = HealPolicy()
        char = make_character(hp=99, max_hp=100)

        assert policy.should_heal(char, threshold=100) is True


class TestHealPolicyIsFullHealth:
    """Tests for HealPolicy.is_full_health()."""

    def test_full_health(self, make_character):
        """Returns True when hp == max_hp."""
        policy = HealPolicy()
        char = make_character(hp=100, max_hp=100)

        assert policy.is_full_health(char) is True

    def test_not_full_health(self, make_character):
        """Returns False when hp < max_hp."""
        policy = HealPolicy()
        char = make_character(hp=50, max_hp=100)

        assert policy.is_full_health(char) is False

    def test_overheal(self, make_character):
        """Returns True when hp > max_hp (edge case)."""
        policy = HealPolicy()
        char = make_character(hp=150, max_hp=100)

        assert policy.is_full_health(char) is True


class TestHealPolicyChooseHealMethod:
    """Tests for HealPolicy.choose_heal_method()."""

    def test_choose_rest(self, make_character):
        """Default heal method should return REST."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100)
        config = {"heal_method": "rest"}

        plan = policy.choose_heal_method(char, config)

        assert plan.action_type == ActionType.REST

    def test_choose_rest_default(self, make_character):
        """Empty config should default to REST."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100)

        plan = policy.choose_heal_method(char, {})

        assert plan.action_type == ActionType.REST

    def test_choose_consumable(self, make_character):
        """When heal_method is consumable and character has the item, returns USE_ITEM."""
        policy = HealPolicy()
        char = make_character(
            hp=30,
            max_hp=100,
            inventory=[InventorySlot(slot=0, code="cooked_chicken", quantity=3)],
        )
        config = {
            "heal_method": "consumable",
            "consumable_code": "cooked_chicken",
        }

        plan = policy.choose_heal_method(char, config)

        assert plan.action_type == ActionType.USE_ITEM
        assert plan.params["code"] == "cooked_chicken"
        assert plan.params["quantity"] == 1

    def test_choose_consumable_not_in_inventory(self, make_character):
        """When consumable is not in inventory, falls back to REST."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100, inventory=[])
        config = {
            "heal_method": "consumable",
            "consumable_code": "cooked_chicken",
        }

        plan = policy.choose_heal_method(char, config)

        assert plan.action_type == ActionType.REST

    def test_choose_consumable_no_code(self, make_character):
        """When heal_method is consumable but no consumable_code, falls back to REST."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100)
        config = {"heal_method": "consumable"}

        plan = policy.choose_heal_method(char, config)

        assert plan.action_type == ActionType.REST

    def test_plan_contains_reason(self, make_character):
        """The returned plan should always have a non-empty reason string."""
        policy = HealPolicy()
        char = make_character(hp=30, max_hp=100)

        plan = policy.choose_heal_method(char, {})

        assert plan.reason != ""
        assert "30" in plan.reason  # HP value should appear in reason
