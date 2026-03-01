from __future__ import annotations

import logging
from enum import Enum
from typing import TYPE_CHECKING

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema

if TYPE_CHECKING:
    from app.engine.decision.resource_selector import ResourceSelector
    from app.schemas.game import ResourceSchema

logger = logging.getLogger(__name__)


class _GatherState(str, Enum):
    """Internal state machine states for the gathering loop."""

    MOVE_TO_RESOURCE = "move_to_resource"
    GATHER = "gather"
    CHECK_INVENTORY = "check_inventory"
    MOVE_TO_BANK = "move_to_bank"
    DEPOSIT = "deposit"


class GatheringStrategy(BaseStrategy):
    """Automated gathering strategy.

    State machine flow::

        MOVE_TO_RESOURCE -> GATHER -> CHECK_INVENTORY
                                           |
                                  (full?)  -> MOVE_TO_BANK -> DEPOSIT -> MOVE_TO_RESOURCE
                                  (ok?)    -> MOVE_TO_RESOURCE (loop)
                                           |
                                  (max_loops reached?) -> COMPLETE

    Configuration keys (see :class:`~app.schemas.automation.GatheringConfig`):
        - resource_code: str
        - deposit_on_full: bool (default True)
        - max_loops: int (default 0 = infinite)
    """

    def __init__(
        self,
        config: dict,
        pathfinder: Pathfinder,
        resource_selector: ResourceSelector | None = None,
        resources_data: list[ResourceSchema] | None = None,
    ) -> None:
        super().__init__(config, pathfinder)
        self._state = _GatherState.MOVE_TO_RESOURCE

        # Parsed config with defaults
        self._resource_code: str = config.get("resource_code", "")
        self._deposit_on_full: bool = config.get("deposit_on_full", True)
        self._max_loops: int = config.get("max_loops", 0)

        # Decision modules
        self._resource_selector = resource_selector
        self._resources_data = resources_data or []

        # Runtime counters
        self._loop_count: int = 0

        # Cached locations (resolved lazily)
        self._resource_pos: tuple[int, int] | None = None
        self._bank_pos: tuple[int, int] | None = None

    def get_state(self) -> str:
        return self._state.value

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        # Auto-select resource if code is empty or "auto"
        if (not self._resource_code or self._resource_code == "auto") and self._resource_selector and self._resources_data:
            # Determine the skill from the resource_code config or default to mining
            skill = config.get("skill", "") if (config := self.config) else ""
            if not skill:
                skill = "mining"
            selection = self._resource_selector.select_optimal(character, self._resources_data, skill)
            if selection:
                self._resource_code = selection.resource.code
                logger.info("Auto-selected resource %s for character %s", selection.resource.code, character.name)

        # Check loop limit
        if self._max_loops > 0 and self._loop_count >= self._max_loops:
            return ActionPlan(
                ActionType.COMPLETE,
                reason=f"Completed {self._loop_count}/{self._max_loops} gather-deposit cycles",
            )

        # Lazily resolve tile positions
        self._resolve_locations(character)

        match self._state:
            case _GatherState.MOVE_TO_RESOURCE:
                return self._handle_move_to_resource(character)
            case _GatherState.GATHER:
                return self._handle_gather(character)
            case _GatherState.CHECK_INVENTORY:
                return self._handle_check_inventory(character)
            case _GatherState.MOVE_TO_BANK:
                return self._handle_move_to_bank(character)
            case _GatherState.DEPOSIT:
                return self._handle_deposit(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_move_to_resource(self, character: CharacterSchema) -> ActionPlan:
        if self._resource_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"No map tile found for resource {self._resource_code}",
            )

        rx, ry = self._resource_pos

        # Already at the resource tile
        if self._is_at(character, rx, ry):
            self._state = _GatherState.GATHER
            return self._handle_gather(character)

        self._state = _GatherState.GATHER  # transition after move
        return ActionPlan(
            ActionType.MOVE,
            params={"x": rx, "y": ry},
            reason=f"Moving to resource {self._resource_code} at ({rx}, {ry})",
        )

    def _handle_gather(self, character: CharacterSchema) -> ActionPlan:
        # Before gathering, check if inventory is full
        if self._inventory_free_slots(character) == 0:
            self._state = _GatherState.CHECK_INVENTORY
            return self._handle_check_inventory(character)

        self._state = _GatherState.CHECK_INVENTORY  # after gather we check inventory
        return ActionPlan(
            ActionType.GATHER,
            reason=f"Gathering {self._resource_code}",
        )

    def _handle_check_inventory(self, character: CharacterSchema) -> ActionPlan:
        free_slots = self._inventory_free_slots(character)

        if free_slots == 0 and self._deposit_on_full:
            self._state = _GatherState.MOVE_TO_BANK
            return self._handle_move_to_bank(character)

        if free_slots == 0 and not self._deposit_on_full:
            # Inventory full and not depositing -- complete the automation
            return ActionPlan(
                ActionType.COMPLETE,
                reason="Inventory full and deposit_on_full is disabled",
            )

        # Inventory has space, go gather more
        self._state = _GatherState.MOVE_TO_RESOURCE
        return self._handle_move_to_resource(character)

    def _handle_move_to_bank(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(
                ActionType.IDLE,
                reason="No bank tile found on map",
            )

        bx, by = self._bank_pos

        if self._is_at(character, bx, by):
            self._state = _GatherState.DEPOSIT
            return self._handle_deposit(character)

        self._state = _GatherState.DEPOSIT  # transition after move
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to deposit items",
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

        # All items deposited -- count the loop and go back to resource
        self._loop_count += 1
        logger.info(
            "Gather-deposit cycle %d completed for %s",
            self._loop_count,
            self._resource_code,
        )

        self._state = _GatherState.MOVE_TO_RESOURCE
        return self._handle_move_to_resource(character)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_locations(self, character: CharacterSchema) -> None:
        """Lazily resolve and cache resource / bank tile positions."""
        if self._resource_pos is None:
            self._resource_pos = self.pathfinder.find_nearest(
                character.x, character.y, "resource", self._resource_code
            )
            if self._resource_pos:
                logger.info(
                    "Resolved resource %s at %s",
                    self._resource_code,
                    self._resource_pos,
                )

        if self._bank_pos is None and self._deposit_on_full:
            self._bank_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "bank"
            )
            if self._bank_pos:
                logger.info("Resolved bank at %s", self._bank_pos)
