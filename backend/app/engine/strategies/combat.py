from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema

if TYPE_CHECKING:
    from app.engine.decision.equipment_optimizer import EquipmentOptimizer
    from app.engine.decision.monster_selector import MonsterSelector
    from app.schemas.game import ItemSchema, MonsterSchema

logger = logging.getLogger(__name__)


class _CombatState(str, Enum):
    """Internal state machine states for the combat loop."""

    MOVE_TO_MONSTER = "move_to_monster"
    FIGHT = "fight"
    CHECK_HEALTH = "check_health"
    HEAL = "heal"
    CHECK_INVENTORY = "check_inventory"
    MOVE_TO_BANK = "move_to_bank"
    DEPOSIT = "deposit"


class CombatStrategy(BaseStrategy):
    """Automated combat strategy.

    State machine flow::

        MOVE_TO_MONSTER -> FIGHT -> CHECK_HEALTH
                                       |
                              (HP low?) -> HEAL -> CHECK_HEALTH
                                       |
                              (HP OK?)  -> CHECK_INVENTORY
                                              |
                                    (full?)  -> MOVE_TO_BANK -> DEPOSIT -> MOVE_TO_MONSTER
                                    (ok?)    -> MOVE_TO_MONSTER (loop)

    Configuration keys (see :class:`~app.schemas.automation.CombatConfig`):
        - monster_code: str
        - auto_heal_threshold: int (default 50) -- percentage
        - heal_method: str (default "rest") -- "rest" or "consumable"
        - consumable_code: str | None
        - min_inventory_slots: int (default 3)
        - deposit_loot: bool (default True)
    """

    def __init__(
        self,
        config: dict,
        pathfinder: Pathfinder,
        monster_selector: MonsterSelector | None = None,
        monsters_data: list[MonsterSchema] | None = None,
        equipment_optimizer: EquipmentOptimizer | None = None,
        available_items: list[ItemSchema] | None = None,
    ) -> None:
        super().__init__(
            config, pathfinder,
            equipment_optimizer=equipment_optimizer,
            available_items=available_items,
        )
        self._state = _CombatState.MOVE_TO_MONSTER

        # Parsed config with defaults
        self._monster_code: str = config.get("monster_code", "")
        self._heal_threshold: int = config.get("auto_heal_threshold", 50)
        self._heal_method: str = config.get("heal_method", "rest")
        self._consumable_code: str | None = config.get("consumable_code")
        self._min_inv_slots: int = config.get("min_inventory_slots", 3)
        self._deposit_loot: bool = config.get("deposit_loot", True)

        # Decision modules
        self._monster_selector = monster_selector
        self._monsters_data = monsters_data or []

        # Cached locations (resolved lazily)
        self._monster_pos: tuple[int, int] | None = None
        self._bank_pos: tuple[int, int] | None = None

    def get_state(self) -> str:
        return self._state.value

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        # Auto-select monster if code is empty or "auto"
        if (not self._monster_code or self._monster_code == "auto") and self._monster_selector and self._monsters_data:
            selected = self._monster_selector.select_optimal(character, self._monsters_data)
            if selected:
                self._monster_code = selected.code
                logger.info("Auto-selected monster %s for character %s", selected.code, character.name)

        # Check auto-equip on first tick
        equip_action = self._check_auto_equip(character)
        if equip_action is not None:
            return equip_action

        # Lazily resolve monster and bank positions
        self._resolve_locations(character)

        match self._state:
            case _CombatState.MOVE_TO_MONSTER:
                return self._handle_move_to_monster(character)
            case _CombatState.FIGHT:
                return self._handle_fight(character)
            case _CombatState.CHECK_HEALTH:
                return self._handle_check_health(character)
            case _CombatState.HEAL:
                return self._handle_heal(character)
            case _CombatState.CHECK_INVENTORY:
                return self._handle_check_inventory(character)
            case _CombatState.MOVE_TO_BANK:
                return self._handle_move_to_bank(character)
            case _CombatState.DEPOSIT:
                return self._handle_deposit(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_move_to_monster(self, character: CharacterSchema) -> ActionPlan:
        if self._monster_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"No map tile found for monster {self._monster_code}",
            )

        mx, my = self._monster_pos

        # Already at the monster tile
        if self._is_at(character, mx, my):
            self._state = _CombatState.FIGHT
            return self._handle_fight(character)

        self._state = _CombatState.FIGHT  # transition after move
        return ActionPlan(
            ActionType.MOVE,
            params={"x": mx, "y": my},
            reason=f"Moving to monster {self._monster_code} at ({mx}, {my})",
        )

    def _handle_fight(self, character: CharacterSchema) -> ActionPlan:
        # Before fighting, check health first
        if self._hp_percent(character) < self._heal_threshold:
            self._state = _CombatState.HEAL
            return self._handle_heal(character)

        self._state = _CombatState.CHECK_HEALTH  # after fight we check health
        return ActionPlan(
            ActionType.FIGHT,
            reason=f"Fighting {self._monster_code}",
        )

    def _handle_check_health(self, character: CharacterSchema) -> ActionPlan:
        if self._hp_percent(character) < self._heal_threshold:
            self._state = _CombatState.HEAL
            return self._handle_heal(character)

        # Health is fine, check inventory
        self._state = _CombatState.CHECK_INVENTORY
        return self._handle_check_inventory(character)

    def _handle_heal(self, character: CharacterSchema) -> ActionPlan:
        # If already at full health, go back to the inventory check
        if self._hp_percent(character) >= 100.0:
            self._state = _CombatState.CHECK_INVENTORY
            return self._handle_check_inventory(character)

        if self._heal_method == "consumable" and self._consumable_code:
            # Check if the character has the consumable in inventory
            has_consumable = any(
                slot.code == self._consumable_code for slot in character.inventory
            )
            if has_consumable:
                # Stay in HEAL state to re-check HP after using the item
                self._state = _CombatState.CHECK_HEALTH
                return ActionPlan(
                    ActionType.USE_ITEM,
                    params={"code": self._consumable_code, "quantity": 1},
                    reason=f"Using consumable {self._consumable_code} to heal",
                )
            else:
                # Fallback to rest if no consumable available
                logger.info(
                    "No %s in inventory, falling back to rest",
                    self._consumable_code,
                )

        # Default: rest to restore HP
        self._state = _CombatState.CHECK_HEALTH
        return ActionPlan(
            ActionType.REST,
            reason=f"Resting to heal (HP {character.hp}/{character.max_hp})",
        )

    def _handle_check_inventory(self, character: CharacterSchema) -> ActionPlan:
        free_slots = self._inventory_free_slots(character)

        if self._deposit_loot and free_slots <= self._min_inv_slots:
            self._state = _CombatState.MOVE_TO_BANK
            return self._handle_move_to_bank(character)

        # Inventory is fine, go fight
        self._state = _CombatState.MOVE_TO_MONSTER
        return self._handle_move_to_monster(character)

    def _handle_move_to_bank(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason="No bank tile found on map",
            )

        bx, by = self._bank_pos

        if self._is_at(character, bx, by):
            self._state = _CombatState.DEPOSIT
            return self._handle_deposit(character)

        self._state = _CombatState.DEPOSIT  # transition after move
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to deposit loot",
        )

    def _handle_deposit(self, character: CharacterSchema) -> ActionPlan:
        # Deposit the first non-empty inventory slot
        for slot in character.inventory:
            if slot.quantity > 0:
                # Stay in DEPOSIT state to deposit the next item on the next tick
                return ActionPlan(
                    ActionType.DEPOSIT_ITEM,
                    params={"code": slot.code, "quantity": slot.quantity},
                    reason=f"Depositing {slot.quantity}x {slot.code}",
                )

        # All items deposited -- go back to monster
        self._state = _CombatState.MOVE_TO_MONSTER
        return self._handle_move_to_monster(character)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_locations(self, character: CharacterSchema) -> None:
        """Lazily resolve and cache monster / bank tile positions."""
        if self._monster_pos is None:
            self._monster_pos = self.pathfinder.find_nearest(
                character.x, character.y, "monster", self._monster_code
            )
            if self._monster_pos:
                logger.info(
                    "Resolved monster %s at %s", self._monster_code, self._monster_pos
                )

        if self._bank_pos is None and self._deposit_loot:
            self._bank_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "bank"
            )
            if self._bank_pos:
                logger.info("Resolved bank at %s", self._bank_pos)
