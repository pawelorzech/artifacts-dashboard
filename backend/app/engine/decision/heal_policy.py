import logging

from app.engine.strategies.base import ActionPlan, ActionType
from app.schemas.game import CharacterSchema

logger = logging.getLogger(__name__)


class HealPolicy:
    """Encapsulates healing decision logic.

    Used by strategies to determine *if* and *how* a character should heal.
    """

    @staticmethod
    def should_heal(character: CharacterSchema, threshold: int) -> bool:
        """Return ``True`` if the character's HP is below *threshold* percent.

        Parameters
        ----------
        character:
            The character to evaluate.
        threshold:
            HP percentage (0-100) below which healing is recommended.
        """
        if character.max_hp == 0:
            return False
        hp_pct = (character.hp / character.max_hp) * 100.0
        return hp_pct < threshold

    @staticmethod
    def is_full_health(character: CharacterSchema) -> bool:
        """Return ``True`` if the character is at maximum HP."""
        return character.hp >= character.max_hp

    @staticmethod
    def choose_heal_method(character: CharacterSchema, config: dict) -> ActionPlan:
        """Decide between resting and using a consumable.

        Parameters
        ----------
        character:
            Current character state.
        config:
            Strategy config dict containing ``heal_method``,
            ``consumable_code``, etc.

        Returns
        -------
        An :class:`ActionPlan` for the chosen healing action.
        """
        heal_method = config.get("heal_method", "rest")
        consumable_code: str | None = config.get("consumable_code")

        if heal_method == "consumable" and consumable_code:
            # Verify the character actually has the consumable
            has_item = any(
                slot.code == consumable_code for slot in character.inventory
            )
            if has_item:
                return ActionPlan(
                    ActionType.USE_ITEM,
                    params={"code": consumable_code, "quantity": 1},
                    reason=f"Using {consumable_code} to heal ({character.hp}/{character.max_hp} HP)",
                )
            else:
                logger.info(
                    "Consumable %s not in inventory for %s, falling back to rest",
                    consumable_code,
                    character.name,
                )

        # Default / fallback: rest
        return ActionPlan(
            ActionType.REST,
            reason=f"Resting to heal ({character.hp}/{character.max_hp} HP)",
        )
