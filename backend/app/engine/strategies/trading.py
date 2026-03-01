import logging
from enum import Enum

from app.engine.pathfinder import Pathfinder
from app.engine.strategies.base import ActionPlan, ActionType, BaseStrategy
from app.schemas.game import CharacterSchema

logger = logging.getLogger(__name__)


class _TradingState(str, Enum):
    """Internal state machine states for the trading loop."""

    MOVE_TO_BANK = "move_to_bank"
    WITHDRAW_ITEMS = "withdraw_items"
    MOVE_TO_GE = "move_to_ge"
    CREATE_SELL_ORDER = "create_sell_order"
    CREATE_BUY_ORDER = "create_buy_order"
    WAIT_FOR_ORDER = "wait_for_order"
    CHECK_ORDERS = "check_orders"
    COLLECT_ITEMS = "collect_items"
    DEPOSIT_ITEMS = "deposit_items"


# ActionType extensions for GE operations (handled via params in the runner)
# We reuse CRAFT action type slot to send GE-specific actions; the runner
# dispatches based on action_type enum. We add new action types to base.

class _TradingMode(str, Enum):
    SELL_LOOT = "sell_loot"
    BUY_MATERIALS = "buy_materials"
    FLIP = "flip"


class TradingStrategy(BaseStrategy):
    """Automated Grand Exchange trading strategy.

    Supports three modes:

    **sell_loot** -- Move to bank, withdraw items, move to GE, create sell orders.
    **buy_materials** -- Move to GE, create buy orders, wait, collect.
    **flip** -- Buy low, sell high based on price history margins.

    Configuration keys (see :class:`~app.schemas.automation.TradingConfig`):
        - mode: str ("sell_loot"|"buy_materials"|"flip")
        - item_code: str
        - quantity: int (default 1)
        - min_price: int (default 0) -- minimum acceptable price
        - max_price: int (default 0) -- maximum acceptable price (0 = no limit)
    """

    def __init__(self, config: dict, pathfinder: Pathfinder) -> None:
        super().__init__(config, pathfinder)

        # Parse config
        mode_str = config.get("mode", "sell_loot")
        try:
            self._mode = _TradingMode(mode_str)
        except ValueError:
            logger.warning("Unknown trading mode %r, defaulting to sell_loot", mode_str)
            self._mode = _TradingMode.SELL_LOOT

        self._item_code: str = config["item_code"]
        self._quantity: int = config.get("quantity", 1)
        self._min_price: int = config.get("min_price", 0)
        self._max_price: int = config.get("max_price", 0)

        # Determine initial state based on mode
        if self._mode == _TradingMode.SELL_LOOT:
            self._state = _TradingState.MOVE_TO_BANK
        elif self._mode == _TradingMode.BUY_MATERIALS:
            self._state = _TradingState.MOVE_TO_GE
        elif self._mode == _TradingMode.FLIP:
            self._state = _TradingState.MOVE_TO_GE
        else:
            self._state = _TradingState.MOVE_TO_GE

        # Runtime state
        self._items_withdrawn: int = 0
        self._orders_created: bool = False
        self._wait_cycles: int = 0

        # Cached positions
        self._bank_pos: tuple[int, int] | None = None
        self._ge_pos: tuple[int, int] | None = None

    def get_state(self) -> str:
        return f"{self._mode.value}:{self._state.value}"

    async def next_action(self, character: CharacterSchema) -> ActionPlan:
        self._resolve_locations(character)

        match self._state:
            case _TradingState.MOVE_TO_BANK:
                return self._handle_move_to_bank(character)
            case _TradingState.WITHDRAW_ITEMS:
                return self._handle_withdraw_items(character)
            case _TradingState.MOVE_TO_GE:
                return self._handle_move_to_ge(character)
            case _TradingState.CREATE_SELL_ORDER:
                return self._handle_create_sell_order(character)
            case _TradingState.CREATE_BUY_ORDER:
                return self._handle_create_buy_order(character)
            case _TradingState.WAIT_FOR_ORDER:
                return self._handle_wait_for_order(character)
            case _TradingState.CHECK_ORDERS:
                return self._handle_check_orders(character)
            case _TradingState.COLLECT_ITEMS:
                return self._handle_collect_items(character)
            case _TradingState.DEPOSIT_ITEMS:
                return self._handle_deposit_items(character)
            case _:
                return ActionPlan(ActionType.IDLE, reason="Unknown trading state")

    # ------------------------------------------------------------------
    # State handlers
    # ------------------------------------------------------------------

    def _handle_move_to_bank(self, character: CharacterSchema) -> ActionPlan:
        if self._bank_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No bank tile found")

        bx, by = self._bank_pos
        if self._is_at(character, bx, by):
            self._state = _TradingState.WITHDRAW_ITEMS
            return self._handle_withdraw_items(character)

        self._state = _TradingState.WITHDRAW_ITEMS
        return ActionPlan(
            ActionType.MOVE,
            params={"x": bx, "y": by},
            reason=f"Moving to bank at ({bx}, {by}) to withdraw items for sale",
        )

    def _handle_withdraw_items(self, character: CharacterSchema) -> ActionPlan:
        # Calculate how many we still need to withdraw
        remaining = self._quantity - self._items_withdrawn
        if remaining <= 0:
            self._state = _TradingState.MOVE_TO_GE
            return self._handle_move_to_ge(character)

        # Check inventory space
        free = self._inventory_free_slots(character)
        if free <= 0:
            self._state = _TradingState.MOVE_TO_GE
            return self._handle_move_to_ge(character)

        withdraw_qty = min(remaining, free)
        self._items_withdrawn += withdraw_qty

        return ActionPlan(
            ActionType.WITHDRAW_ITEM,
            params={"code": self._item_code, "quantity": withdraw_qty},
            reason=f"Withdrawing {withdraw_qty}x {self._item_code} for GE sale",
        )

    def _handle_move_to_ge(self, character: CharacterSchema) -> ActionPlan:
        if self._ge_pos is None:
            return ActionPlan(ActionType.IDLE, reason="No Grand Exchange tile found")

        gx, gy = self._ge_pos
        if self._is_at(character, gx, gy):
            if self._mode == _TradingMode.SELL_LOOT:
                self._state = _TradingState.CREATE_SELL_ORDER
                return self._handle_create_sell_order(character)
            elif self._mode == _TradingMode.BUY_MATERIALS:
                self._state = _TradingState.CREATE_BUY_ORDER
                return self._handle_create_buy_order(character)
            elif self._mode == _TradingMode.FLIP:
                if not self._orders_created:
                    self._state = _TradingState.CREATE_BUY_ORDER
                    return self._handle_create_buy_order(character)
                else:
                    self._state = _TradingState.CREATE_SELL_ORDER
                    return self._handle_create_sell_order(character)
            return ActionPlan(ActionType.IDLE, reason="At GE but unknown mode")

        # Determine next state based on mode
        if self._mode == _TradingMode.SELL_LOOT:
            self._state = _TradingState.CREATE_SELL_ORDER
        elif self._mode == _TradingMode.BUY_MATERIALS:
            self._state = _TradingState.CREATE_BUY_ORDER
        elif self._mode == _TradingMode.FLIP:
            self._state = _TradingState.CREATE_BUY_ORDER

        return ActionPlan(
            ActionType.MOVE,
            params={"x": gx, "y": gy},
            reason=f"Moving to Grand Exchange at ({gx}, {gy})",
        )

    def _handle_create_sell_order(self, character: CharacterSchema) -> ActionPlan:
        # Check if we have items to sell in inventory
        item_in_inv = None
        for slot in character.inventory:
            if slot.code == self._item_code and slot.quantity > 0:
                item_in_inv = slot
                break

        if item_in_inv is None:
            # Nothing to sell, we're done
            return ActionPlan(
                ActionType.COMPLETE,
                reason=f"No {self._item_code} in inventory to sell",
            )

        sell_price = self._min_price if self._min_price > 0 else 1
        sell_qty = min(item_in_inv.quantity, self._quantity)

        self._orders_created = True
        self._state = _TradingState.WAIT_FOR_ORDER

        return ActionPlan(
            ActionType.GE_SELL,
            params={
                "code": self._item_code,
                "quantity": sell_qty,
                "price": sell_price,
            },
            reason=f"Creating sell order: {sell_qty}x {self._item_code} at {sell_price} gold each",
        )

    def _handle_create_buy_order(self, character: CharacterSchema) -> ActionPlan:
        buy_price = self._max_price if self._max_price > 0 else 1

        self._orders_created = True
        self._state = _TradingState.WAIT_FOR_ORDER

        return ActionPlan(
            ActionType.GE_BUY,
            params={
                "code": self._item_code,
                "quantity": self._quantity,
                "price": buy_price,
            },
            reason=f"Creating buy order: {self._quantity}x {self._item_code} at {buy_price} gold each",
        )

    def _handle_wait_for_order(self, character: CharacterSchema) -> ActionPlan:
        self._wait_cycles += 1

        # Wait for a reasonable time, then check
        if self._wait_cycles < 3:
            return ActionPlan(
                ActionType.IDLE,
                reason=f"Waiting for GE order to fill (cycle {self._wait_cycles})",
            )

        # After waiting, check orders
        self._state = _TradingState.CHECK_ORDERS
        return self._handle_check_orders(character)

    def _handle_check_orders(self, character: CharacterSchema) -> ActionPlan:
        # For now, just complete after creating orders
        # In a full implementation, we'd check the GE order status
        if self._mode == _TradingMode.FLIP and self._orders_created:
            # For flip mode, once buy order is done, create sell
            self._state = _TradingState.CREATE_SELL_ORDER
            return ActionPlan(
                ActionType.IDLE,
                reason="Checking order status for flip trade",
            )

        return ActionPlan(
            ActionType.COMPLETE,
            reason=f"Trading operation complete for {self._item_code} (mode={self._mode.value})",
        )

    def _handle_collect_items(self, character: CharacterSchema) -> ActionPlan:
        # In the actual game, items from filled orders go to inventory automatically
        self._state = _TradingState.DEPOSIT_ITEMS
        return self._handle_deposit_items(character)

    def _handle_deposit_items(self, character: CharacterSchema) -> ActionPlan:
        # Deposit any items in inventory
        for slot in character.inventory:
            if slot.quantity > 0:
                return ActionPlan(
                    ActionType.DEPOSIT_ITEM,
                    params={"code": slot.code, "quantity": slot.quantity},
                    reason=f"Depositing {slot.quantity}x {slot.code} from trading",
                )

        return ActionPlan(
            ActionType.COMPLETE,
            reason=f"Trading complete for {self._item_code}",
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_locations(self, character: CharacterSchema) -> None:
        """Lazily resolve and cache bank and GE tile positions."""
        if self._bank_pos is None:
            self._bank_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "bank"
            )
            if self._bank_pos:
                logger.info("Resolved bank at %s", self._bank_pos)

        if self._ge_pos is None:
            self._ge_pos = self.pathfinder.find_nearest_by_type(
                character.x, character.y, "grand_exchange"
            )
            if self._ge_pos:
                logger.info("Resolved Grand Exchange at %s", self._ge_pos)
