"""Equipment optimizer for suggesting gear improvements."""

import logging
from dataclasses import dataclass, field

from app.schemas.game import CharacterSchema, ItemSchema

logger = logging.getLogger(__name__)

# Equipment slot names and the item types that can go in them
_SLOT_TYPE_MAP: dict[str, list[str]] = {
    "weapon_slot": ["weapon"],
    "shield_slot": ["shield"],
    "helmet_slot": ["helmet"],
    "body_armor_slot": ["body_armor"],
    "leg_armor_slot": ["leg_armor"],
    "boots_slot": ["boots"],
    "ring1_slot": ["ring"],
    "ring2_slot": ["ring"],
    "amulet_slot": ["amulet"],
    "artifact1_slot": ["artifact"],
    "artifact2_slot": ["artifact"],
    "artifact3_slot": ["artifact"],
}

# Effect names that contribute to the equipment score
_ATTACK_EFFECTS = {"attack_fire", "attack_earth", "attack_water", "attack_air"}
_DEFENSE_EFFECTS = {"res_fire", "res_earth", "res_water", "res_air"}
_HP_EFFECTS = {"hp"}
_DAMAGE_EFFECTS = {"dmg_fire", "dmg_earth", "dmg_water", "dmg_air"}


@dataclass
class EquipmentSuggestion:
    """A suggestion to equip a different item in a slot."""

    slot: str
    current_item_code: str
    suggested_item_code: str
    current_score: float
    suggested_score: float
    improvement: float
    reason: str


@dataclass
class EquipmentAnalysis:
    """Full analysis of a character's equipment vs available items."""

    suggestions: list[EquipmentSuggestion] = field(default_factory=list)
    total_current_score: float = 0.0
    total_best_score: float = 0.0


class EquipmentOptimizer:
    """Analyzes character equipment and suggests improvements.

    Uses a simple scoring system: sum of all attack + defense + HP stats
    from item effects.
    """

    def suggest_equipment(
        self,
        character: CharacterSchema,
        available_items: list[ItemSchema],
    ) -> EquipmentAnalysis:
        """Analyze the character's current equipment and suggest improvements.

        Parameters
        ----------
        character:
            The character to analyze.
        available_items:
            Items available to the character (e.g. from bank).

        Returns
        -------
        EquipmentAnalysis with suggestions for each slot where a better item exists.
        """
        # Build a lookup of item code -> ItemSchema
        item_lookup: dict[str, ItemSchema] = {
            item.code: item for item in available_items
        }

        analysis = EquipmentAnalysis()

        for slot, valid_types in _SLOT_TYPE_MAP.items():
            current_code = getattr(character, slot, "")
            current_item = item_lookup.get(current_code) if current_code else None
            current_score = self._score_item(current_item) if current_item else 0.0

            # Find the best available item for this slot
            candidates = [
                item
                for item in available_items
                if item.type in valid_types and item.level <= character.level
            ]

            if not candidates:
                analysis.total_current_score += current_score
                analysis.total_best_score += current_score
                continue

            best_candidate = max(candidates, key=lambda i: self._score_item(i))
            best_score = self._score_item(best_candidate)

            analysis.total_current_score += current_score
            analysis.total_best_score += max(current_score, best_score)

            # Only suggest if there's an actual improvement
            improvement = best_score - current_score
            if improvement > 0 and best_candidate.code != current_code:
                suggestion = EquipmentSuggestion(
                    slot=slot,
                    current_item_code=current_code or "(empty)",
                    suggested_item_code=best_candidate.code,
                    current_score=current_score,
                    suggested_score=best_score,
                    improvement=improvement,
                    reason=(
                        f"Replace {current_code or 'empty'} "
                        f"(score {current_score:.1f}) with {best_candidate.code} "
                        f"(score {best_score:.1f}, +{improvement:.1f})"
                    ),
                )
                analysis.suggestions.append(suggestion)

        # Sort suggestions by improvement descending
        analysis.suggestions.sort(key=lambda s: s.improvement, reverse=True)

        return analysis

    @staticmethod
    def _score_item(item: ItemSchema | None) -> float:
        """Calculate a simple composite score for an item.

        Score = sum of all attack effects + defense effects + HP + damage effects.
        """
        if item is None:
            return 0.0

        score = 0.0
        for effect in item.effects:
            name = effect.name.lower()
            if name in _ATTACK_EFFECTS:
                score += effect.value
            elif name in _DEFENSE_EFFECTS:
                score += effect.value
            elif name in _HP_EFFECTS:
                score += effect.value * 0.5  # HP is weighted less than raw stats
            elif name in _DAMAGE_EFFECTS:
                score += effect.value * 1.5  # Damage bonuses are weighted higher

        # Small bonus for higher-level items (tie-breaker)
        score += item.level * 0.1

        return score
