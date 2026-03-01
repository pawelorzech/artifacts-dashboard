from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema, ItemSchema

if TYPE_CHECKING:
    from app.schemas.game import ResourceSchema

logger = logging.getLogger(__name__)


class _CraftState(str, Enum):
    """Internal state machine states for the crafting loop."""

    CHECK_MATERIALS = "check_materials"
    GATHER_MATERIALS = "gather_materials"
    MOVE_TO_BANK_WITHDRAW = "move_to_bank_withdraw"
    WITHDRAW_MATERIALS = "withdraw_materials"
    MOVE_TO_WORKSHOP = "move_to_workshop"
    CRAFT = "craft"
    CHECK_RESULT = "check_result"
    MOVE_TO_BANK_DEPOSIT = "move_to_bank_deposit"
    DEPOSIT = "deposit"


# Mapping from craft skill names to their workshop content codes
_SKILL_TO_WORKSHOP: dict[str, str] = {
    "weaponcrafting": "weaponcrafting",
    "gearcrafting": "gearcrafting",
    "jewelrycrafting": "jewelrycrafting",
    "cooking": "cooking",
    "woodcutting": "woodcutting",
    "mining": "mining",
    "alchemy": "alchemy",
}


class CraftingStrategy(BaseStrategy):
    """Automated crafting strategy.

    State machine flow::

        CHECK_MATERIALS -> (missing?) -> MOVE_TO_BANK_WITHDRAW -> WITHDRAW_MATERIALS
                                                                        |
                        -> GATHER_MATERIALS  (if gather_materials=True)  |
                                                                        v
                        -> MOVE_TO_WORKSHOP -> CRAFT -> CHECK_RESULT
                                                           |
                                             (recycle?)  -> CRAFT (loop for XP)
                                             (done?)     -> MOVE_TO_BANK_DEPOSIT -> DEPOSIT
                                                           |
                                             (more qty?)  -> CHECK_MATERIALS (loop)

    Configuration keys (see :class:`~app.schemas.automation.CraftingConfig`):
        - item_code: str -- the item to craft
        - quantity: int (default 1) -- how many to craft total
        - gather_materials: bool (default False) -- auto-gather missing materials
        - recycle_excess: bool (default False) -- recycle crafted items for XP
    """

    def __init__(
        self,
        config: dict,
        pathfinder: Pathfinder,
        items_data: list[ItemSchema] | None = None,
        resources_data: list[ResourceSchema] | None = None,
    ) -> None:
        super().__init__(config, pathfinder)
        self._state = _CraftState.CHECK_MATERIALS

        # Parsed config with defaults
        self._item_code: str = config["item_code"]
        self._quantity: int = config.get("quantity", 1)
        self._gather_materials: bool = config.get("gather_materials", False)
        self._recycle_excess: bool = config.get("recycle_excess", False)

        # Runtime counters
        self._crafted_count: int = 0

        # Recipe data (resolved from game data)
        self._recipe: list[dict[str, str | int]] = []  # [{"code": ..., "quantity": ...}]
        self._craft_skill: str = ""
        self._craft_level: int = 0
        self._recipe_resolved: bool = False

        # Game data for gathering resolution
        self._resources_data: list[ResourceSchema] = resources_data or []

        # If items data is provided, resolve the recipe immediately
        if items_data:
            self._resolve_recipe(items_data)

        # Cached locations
        self._workshop_pos: tuple[int, int] | None = None
        self._bank_pos: tuple[int, int] | None = None

        # Sub-state for gathering
        self._gather_resource_code: str | None = None
        self._gather_pos: tuple[int, int] | None = None

    def get_state(self) -> str:
        return self._state.value

    def set_items_data(self, items_data: list[ItemSchema]) -> None:
        """Set item data for recipe resolution (called by manager after creation)."""
        if not self._recipe_resolved:
            self._resolve_recipe(items_data)

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        # Check if we've completed the target quantity
        if self._crafted_count >= self._quantity and not self._recycle_excess:
            return ActionPlan(
                ActionType.COMPLETE,
                reason=f"Crafted {self._crafted_count}/{self._quantity} {self._item_code}",
            )

        # If recipe is not resolved, idle until it is
        if not self._recipe_resolved:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"Recipe for {self._item_code} not yet resolved from game data",
            )

        # Resolve locations lazily
        self._resolve_locations(character)

        match self._state:
            case _CraftState.CHECK_MATERIALS:
                return self._handle_check_materials(character)
            case _CraftState.GATHER_MATERIALS:
                return self._handle_gather_materials(character)
            case _CraftState.MOVE_TO_BANK_WITHDRAW:
                return self._handle_move_to_bank_withdraw(character)
            case _CraftState.WITHDRAW_MATERIALS:
                return self._handle_withdraw_materials(character)
            case _CraftState.MOVE_TO_WORKSHOP:
                return self._handle_move_to_workshop(character)
            case _CraftState.CRAFT:
                return self._handle_craft(character)
            case _CraftState.CHECK_RESULT:
                return self._handle_check_result(character)
            case _CraftState.MOVE_TO_BANK_DEPOSIT:
                return self._handle_move_to_bank_deposit(character)
            case _CraftState.DEPOSIT:
                return self._handle_deposit(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_check_materials(self, character: CharacterSchema) -> ActionPlan:
        """Check if the character has all required materials in inventory."""
        missing = self._get_missing_materials(character)

        if not missing:
            # All materials in inventory, go craft
            self._state = _CraftState.MOVE_TO_WORKSHOP
            return self._handle_move_to_workshop(character)

        # Materials are missing -- try to withdraw from bank first
        self._state = _CraftState.MOVE_TO_BANK_WITHDRAW
        return self._handle_move_to_bank_withdraw(character)

    def _handle_move_to_bank_withdraw(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No bank tile found on map")

        bx, by = self._bank_pos
        if self._is_at(character, bx, by):
            self._state = _CraftState.WITHDRAW_MATERIALS
            return self._handle_withdraw_materials(character)

        self._state = _CraftState.WITHDRAW_MATERIALS
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to withdraw materials",
        )

    def _handle_withdraw_materials(self, character: CharacterSchema) -> ActionPlan:
        """Withdraw missing materials from the bank one at a time."""
        missing = self._get_missing_materials(character)

        if not missing:
            # All materials acquired, go to workshop
            self._state = _CraftState.MOVE_TO_WORKSHOP
            return self._handle_move_to_workshop(character)

        # Withdraw the first missing material
        code, needed_qty = next(iter(missing.items()))

        # If gather_materials is enabled and we can determine a resource for this material,
        # try gathering instead of just hoping the bank has it
        if self._gather_materials:
            resource_code = self._find_resource_for_material(code)
            if resource_code:
                self._gather_resource_code = resource_code
                self._gather_pos = self.pathfinder.find_nearest(
                    character.x, character.y, "resource", resource_code
                )
                if self._gather_pos:
                    self._state = _CraftState.GATHER_MATERIALS
                    return self._handle_gather_materials(character)

        return ActionPlan(
            ActionType.WITHDRAW_ITEM,
            params={"code": code, "quantity": needed_qty},
            reason=f"Withdrawing {needed_qty}x {code} for crafting {self._item_code}",
        )

    def _handle_gather_materials(self, character: CharacterSchema) -> ActionPlan:
        """Gather missing materials (if gather_materials is enabled)."""
        if self._gather_resource_code is None or self._gather_pos is None:
            # Cannot determine what to gather, fall back to check
            self._state = _CraftState.CHECK_MATERIALS
            return self._handle_check_materials(character)

        gx, gy = self._gather_pos

        if not self._is_at(character, gx, gy):
            return ActionPlan(
                ActionType.MOVE,
                params={"x": gx, "y": gy},
                reason=f"Moving to resource {self._gather_resource_code} at ({gx}, {gy})",
            )

        # Check if inventory is full
        if self._inventory_free_slots(character) == 0:
            # Need to deposit and try again
            self._state = _CraftState.MOVE_TO_BANK_DEPOSIT
            return self._handle_move_to_bank_deposit(character)

        # Check if we still need materials
        missing = self._get_missing_materials(character)
        if not missing:
            self._state = _CraftState.MOVE_TO_WORKSHOP
            return self._handle_move_to_workshop(character)

        return ActionPlan(
            ActionType.GATHER,
            reason=f"Gathering {self._gather_resource_code} for crafting materials",
        )

    def _handle_move_to_workshop(self, character: CharacterSchema) -> ActionPlan:
        if self._workshop_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"No workshop found for skill {self._craft_skill}",
            )

        wx, wy = self._workshop_pos
        if self._is_at(character, wx, wy):
            self._state = _CraftState.CRAFT
            return self._handle_craft(character)

        self._state = _CraftState.CRAFT
        return ActionPlan(
            ActionType.MOVE,
            params={"x": wx, "y": wy},
            reason=f"Moving to {self._craft_skill} workshop at ({wx}, {wy})",
        )

    def _handle_craft(self, character: CharacterSchema) -> ActionPlan:
        # Verify we have materials before crafting
        missing = self._get_missing_materials(character)
        if missing:
            # Somehow lost materials, go back to check
            self._state = _CraftState.CHECK_MATERIALS
            return self._handle_check_materials(character)

        self._state = _CraftState.CHECK_RESULT
        return ActionPlan(
            ActionType.CRAFT,
            params={"code": self._item_code, "quantity": 1},
            reason=f"Crafting {self._item_code} ({self._crafted_count + 1}/{self._quantity})",
        )

    def _handle_check_result(self, character: CharacterSchema) -> ActionPlan:
        self._crafted_count += 1

        if self._recycle_excess:
            # Check if we have the item to recycle
            has_item = any(
                slot.code == self._item_code for slot in character.inventory
            )
            if has_item:
                # Recycle and go back to check materials for next craft
                self._state = _CraftState.CHECK_MATERIALS
                return ActionPlan(
                    ActionType.RECYCLE,
                    params={"code": self._item_code, "quantity": 1},
                    reason=f"Recycling {self._item_code} for XP (crafted {self._crafted_count})",
                )

        # Check if we need to craft more
        if self._crafted_count >= self._quantity:
            # Done crafting, deposit results
            self._state = _CraftState.MOVE_TO_BANK_DEPOSIT
            return self._handle_move_to_bank_deposit(character)

        # Check if inventory is getting full
        if self._inventory_free_slots(character) <= 2:
            self._state = _CraftState.MOVE_TO_BANK_DEPOSIT
            return self._handle_move_to_bank_deposit(character)

        # Craft more
        self._state = _CraftState.CHECK_MATERIALS
        return self._handle_check_materials(character)

    def _handle_move_to_bank_deposit(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No bank tile found on map")

        bx, by = self._bank_pos
        if self._is_at(character, bx, by):
            self._state = _CraftState.DEPOSIT
            return self._handle_deposit(character)

        self._state = _CraftState.DEPOSIT
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to deposit crafted items",
        )

    def _handle_deposit(self, character: CharacterSchema) -> ActionPlan:
        # Deposit the first non-empty inventory slot
        for slot in character.inventory:
            if slot.quantity > 0:
                return ActionPlan(
                    ActionType.DEPOSIT_ITEM,
                    params={"code": slot.code, "quantity": slot.quantity},
                    reason=f"Depositing {slot.quantity}x {slot.code}",
                )

        # All deposited
        if self._crafted_count >= self._quantity and not self._recycle_excess:
            return ActionPlan(
                ActionType.COMPLETE,
                reason=f"Crafted and deposited {self._crafted_count}/{self._quantity} {self._item_code}",
            )

        # More to craft
        self._state = _CraftState.CHECK_MATERIALS
        return self._handle_check_materials(character)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_recipe(self, items_data: list[ItemSchema]) -> None:
        """Look up the item's crafting recipe from game data."""
        for item in items_data:
            if item.code == self._item_code:
                if item.craft is None:
                    logger.warning(
                        "Item %s has no crafting recipe", self._item_code
                    )
                    return

                self._craft_skill = item.craft.skill or ""
                self._craft_level = item.craft.level or 0
                self._recipe = [
                    {"code": ci.code, "quantity": ci.quantity}
                    for ci in item.craft.items
                ]
                self._recipe_resolved = True
                logger.info(
                    "Resolved recipe for %s: skill=%s, level=%d, materials=%s",
                    self._item_code,
                    self._craft_skill,
                    self._craft_level,
                    self._recipe,
                )
                return

        logger.warning("Item %s not found in game data", self._item_code)

    def _get_missing_materials(self, character: CharacterSchema) -> dict[str, int]:
        """Return a dict of {material_code: needed_quantity} for materials
        not currently in the character's inventory."""
        inventory_counts: dict[str, int] = {}
        for slot in character.inventory:
            inventory_counts[slot.code] = inventory_counts.get(slot.code, 0) + slot.quantity

        missing: dict[str, int] = {}
        for mat in self._recipe:
            code = str(mat["code"])
            needed = int(mat["quantity"])
            have = inventory_counts.get(code, 0)
            if have < needed:
                missing[code] = needed - have

        return missing

    def _find_resource_for_material(self, material_code: str) -> str | None:
        """Look up which resource drops the needed material."""
        for resource in self._resources_data:
            for drop in resource.drops:
                if drop.code == material_code:
                    return resource.code
        return None

    def _resolve_locations(self, character: CharacterSchema) -> None:
        """Lazily resolve and cache workshop and bank tile positions."""
        if self._workshop_pos is None and self._craft_skill:
            workshop_code = _SKILL_TO_WORKSHOP.get(self._craft_skill, self._craft_skill)
            self._workshop_pos = self.pathfinder.find_nearest(
                character.x, character.y, "workshop", workshop_code
            )
            if self._workshop_pos:
                logger.info(
                    "Resolved workshop for %s at %s",
                    self._craft_skill,
                    self._workshop_pos,
                )

        if self._bank_pos is None:
            self._bank_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "bank"
            )
            if self._bank_pos:
                logger.info("Resolved bank at %s", self._bank_pos)

        if (
            self._gather_materials
            and self._gather_resource_code is not None
            and self._gather_pos is None
        ):
            self._gather_pos = self.pathfinder.find_nearest(
                character.x, character.y, "resource", self._gather_resource_code
            )
            if self._gather_pos:
                logger.info(
                    "Resolved gather resource %s at %s",
                    self._gather_resource_code,
                    self._gather_pos,
                )
