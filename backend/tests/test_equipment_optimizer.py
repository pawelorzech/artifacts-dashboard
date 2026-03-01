"""Tests for the EquipmentOptimizer decision maker."""

import pytest

from app.engine.decision.equipment_optimizer import (
    EquipmentOptimizer,
    EquipmentSuggestion,
)
from app.schemas.game import EffectSchema, InventorySlot, ItemSchema


class TestScoreItem:
    """Tests for the _score_item static method."""

    def test_score_none_item(self):
        assert EquipmentOptimizer._score_item(None) == 0.0

    def test_score_item_with_attack_effects(self, make_item):
        item = make_item(
            code="fire_sword",
            level=10,
            effects=[
                EffectSchema(name="attack_fire", value=20),
                EffectSchema(name="attack_earth", value=10),
            ],
        )
        score = EquipmentOptimizer._score_item(item)
        # 20 + 10 + (10 * 0.1 level bonus) = 31.0
        assert score == pytest.approx(31.0)

    def test_score_item_with_defense_effects(self, make_item):
        item = make_item(
            code="iron_shield",
            level=5,
            type="shield",
            effects=[
                EffectSchema(name="res_fire", value=15),
                EffectSchema(name="res_water", value=10),
            ],
        )
        score = EquipmentOptimizer._score_item(item)
        # 15 + 10 + (5 * 0.1) = 25.5
        assert score == pytest.approx(25.5)

    def test_score_item_with_hp_weighted_less(self, make_item):
        item = make_item(
            code="hp_ring",
            level=1,
            type="ring",
            effects=[EffectSchema(name="hp", value=100)],
        )
        score = EquipmentOptimizer._score_item(item)
        # 100 * 0.5 + (1 * 0.1) = 50.1
        assert score == pytest.approx(50.1)

    def test_score_item_with_damage_weighted_more(self, make_item):
        item = make_item(
            code="dmg_amulet",
            level=1,
            type="amulet",
            effects=[EffectSchema(name="dmg_fire", value=10)],
        )
        score = EquipmentOptimizer._score_item(item)
        # 10 * 1.5 + (1 * 0.1) = 15.1
        assert score == pytest.approx(15.1)

    def test_score_item_level_bonus_as_tiebreaker(self, make_item):
        low = make_item(code="sword_5", level=5, effects=[EffectSchema(name="attack_fire", value=10)])
        high = make_item(code="sword_10", level=10, effects=[EffectSchema(name="attack_fire", value=10)])

        assert EquipmentOptimizer._score_item(high) > EquipmentOptimizer._score_item(low)

    def test_score_item_with_no_effects(self, make_item):
        item = make_item(code="plain_sword", level=5, effects=[])
        score = EquipmentOptimizer._score_item(item)
        # Only level bonus: 5 * 0.1 = 0.5
        assert score == pytest.approx(0.5)

    def test_score_item_with_unknown_effects(self, make_item):
        item = make_item(
            code="weird_item",
            level=1,
            effects=[EffectSchema(name="unknown_effect", value=100)],
        )
        score = EquipmentOptimizer._score_item(item)
        # Unknown effect not counted: only level bonus 0.1
        assert score == pytest.approx(0.1)


class TestSuggestEquipment:
    """Tests for the suggest_equipment method."""

    def test_empty_available_items(self, make_character):
        optimizer = EquipmentOptimizer()
        char = make_character(level=10)
        analysis = optimizer.suggest_equipment(char, [])

        assert analysis.suggestions == []
        assert analysis.total_current_score == 0.0
        assert analysis.total_best_score == 0.0

    def test_suggest_better_weapon(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        current_weapon = make_item(
            code="rusty_sword",
            level=1,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=5)],
        )
        better_weapon = make_item(
            code="iron_sword",
            level=5,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=20)],
        )
        char = make_character(level=10, weapon_slot="rusty_sword")
        analysis = optimizer.suggest_equipment(char, [current_weapon, better_weapon])

        weapon_suggestions = [s for s in analysis.suggestions if s.slot == "weapon_slot"]
        assert len(weapon_suggestions) == 1
        assert weapon_suggestions[0].suggested_item_code == "iron_sword"
        assert weapon_suggestions[0].improvement > 0

    def test_no_suggestion_when_best_is_equipped(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        best_weapon = make_item(
            code="best_sword",
            level=5,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=50)],
        )
        char = make_character(level=10, weapon_slot="best_sword")
        analysis = optimizer.suggest_equipment(char, [best_weapon])

        weapon_suggestions = [s for s in analysis.suggestions if s.slot == "weapon_slot"]
        assert len(weapon_suggestions) == 0

    def test_item_too_high_level_not_suggested(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        high_level_weapon = make_item(
            code="dragon_sword",
            level=50,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=100)],
        )
        char = make_character(level=10, weapon_slot="")
        analysis = optimizer.suggest_equipment(char, [high_level_weapon])

        # Too high level, should not be suggested
        weapon_suggestions = [s for s in analysis.suggestions if s.slot == "weapon_slot"]
        assert len(weapon_suggestions) == 0

    def test_suggestions_sorted_by_improvement(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        weapon = make_item(
            code="great_sword",
            level=5,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=30)],
        )
        shield = make_item(
            code="great_shield",
            level=5,
            type="shield",
            effects=[EffectSchema(name="res_fire", value=50)],
        )
        char = make_character(level=10, weapon_slot="", shield_slot="")
        analysis = optimizer.suggest_equipment(char, [weapon, shield])

        # Both should be suggested; shield has higher improvement
        assert len(analysis.suggestions) >= 2
        # Sorted descending by improvement
        for i in range(len(analysis.suggestions) - 1):
            assert analysis.suggestions[i].improvement >= analysis.suggestions[i + 1].improvement

    def test_multiple_slot_types_for_rings(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        ring = make_item(
            code="power_ring",
            level=5,
            type="ring",
            effects=[EffectSchema(name="attack_fire", value=10)],
        )
        char = make_character(level=10, ring1_slot="", ring2_slot="")
        analysis = optimizer.suggest_equipment(char, [ring])

        ring_suggestions = [
            s for s in analysis.suggestions if s.slot in ("ring1_slot", "ring2_slot")
        ]
        # Both ring slots should get the suggestion
        assert len(ring_suggestions) == 2

    def test_total_scores_computed(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        weapon = make_item(
            code="iron_sword",
            level=5,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=10)],
        )
        char = make_character(level=10, weapon_slot="")
        analysis = optimizer.suggest_equipment(char, [weapon])

        assert analysis.total_best_score >= analysis.total_current_score

    def test_empty_slot_shows_empty_in_suggestion(self, make_character, make_item):
        optimizer = EquipmentOptimizer()

        weapon = make_item(
            code="iron_sword",
            level=5,
            type="weapon",
            effects=[EffectSchema(name="attack_fire", value=10)],
        )
        char = make_character(level=10, weapon_slot="")
        analysis = optimizer.suggest_equipment(char, [weapon])

        weapon_suggestions = [s for s in analysis.suggestions if s.slot == "weapon_slot"]
        assert len(weapon_suggestions) == 1
        assert weapon_suggestions[0].current_item_code == "(empty)"
