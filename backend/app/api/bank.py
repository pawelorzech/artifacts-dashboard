import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from httpx import HTTPStatusError
from pydantic import BaseModel, Field

from app.api.deps import get_user_client
from app.database import async_session_factory
from app.services.bank_service import BankService
from app.services.game_data_cache import GameDataCacheService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["bank"])


def _get_cache_service(request: Request) -> GameDataCacheService:
    return request.app.state.cache_service


# ---------------------------------------------------------------------------
# Request schemas for manual actions
# ---------------------------------------------------------------------------


class ManualActionRequest(BaseModel):
    """Request body for manual character actions."""

    action: str = Field(
        ...,
        description=(
            "Action to perform: move, fight, gather, rest, equip, unequip, "
            "use_item, deposit, withdraw, deposit_gold, withdraw_gold, "
            "craft, recycle, ge_buy, ge_create_buy, ge_sell, ge_fill, ge_cancel, "
            "task_new, task_trade, task_complete, task_exchange, task_cancel, "
            "npc_buy, npc_sell"
        ),
    )
    params: dict = Field(
        default_factory=dict,
        description="Action parameters (varies per action type)",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/bank")
async def get_bank(request: Request) -> dict[str, Any]:
    """Return bank details with enriched item data from game cache."""
    client = get_user_client(request)
    cache_service = _get_cache_service(request)
    bank_service = BankService()

    try:
        # Try to get items cache for enrichment
        items_cache = None
        try:
            async with async_session_factory() as db:
                items_cache = await cache_service.get_items(db)
        except Exception:
            logger.warning("Failed to load items cache for bank enrichment")

        result = await bank_service.get_contents(client, items_cache)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return result


@router.get("/bank/summary")
async def get_bank_summary(request: Request) -> dict[str, Any]:
    """Return a summary of bank contents: gold, item count, slots."""
    client = get_user_client(request)
    bank_service = BankService()

    try:
        return await bank_service.get_summary(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc


def _require(params: dict, *keys: str) -> None:
    """Raise 400 if any required key is missing from params."""
    missing = [k for k in keys if params.get(k) is None]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required params: {', '.join(missing)}",
        )


@router.post("/characters/{name}/action")
async def manual_action(
    name: str,
    body: ManualActionRequest,
    request: Request,
) -> dict[str, Any]:
    """Execute a manual action on a character.

    Supported actions and their params:
    - **move**: {x: int, y: int}
    - **fight**: no params
    - **gather**: no params
    - **rest**: no params
    - **equip**: {code: str, slot: str, quantity?: int}
    - **unequip**: {slot: str, quantity?: int}
    - **use_item**: {code: str, quantity?: int}
    - **deposit**: {code: str, quantity: int}
    - **withdraw**: {code: str, quantity: int}
    - **deposit_gold**: {quantity: int}
    - **withdraw_gold**: {quantity: int}
    - **craft**: {code: str, quantity?: int}
    - **recycle**: {code: str, quantity?: int}
    - **ge_buy**: {id: str, quantity: int} — buy from an existing sell order
    - **ge_create_buy**: {code: str, quantity: int, price: int} — create a standing buy order
    - **ge_sell**: {code: str, quantity: int, price: int} — create a sell order
    - **ge_fill**: {id: str, quantity: int} — fill an existing buy order
    - **ge_cancel**: {order_id: str}
    - **task_new**: no params
    - **task_trade**: {code: str, quantity: int}
    - **task_complete**: no params
    - **task_exchange**: no params
    - **task_cancel**: no params
    - **npc_buy**: {code: str, quantity: int}
    - **npc_sell**: {code: str, quantity: int}
    """
    client = get_user_client(request)
    p = body.params

    try:
        match body.action:
            # --- Basic actions ---
            case "move":
                _require(p, "x", "y")
                result = await client.move(name, int(p["x"]), int(p["y"]))
            case "fight":
                result = await client.fight(name)
            case "gather":
                result = await client.gather(name)
            case "rest":
                result = await client.rest(name)

            # --- Equipment ---
            case "equip":
                _require(p, "code", "slot")
                result = await client.equip(
                    name, p["code"], p["slot"], int(p.get("quantity", 1))
                )
            case "unequip":
                _require(p, "slot")
                result = await client.unequip(
                    name, p["slot"], int(p.get("quantity", 1))
                )

            # --- Consumables ---
            case "use_item":
                _require(p, "code")
                result = await client.use_item(
                    name, p["code"], int(p.get("quantity", 1))
                )

            # --- Bank ---
            case "deposit":
                _require(p, "code", "quantity")
                result = await client.deposit_item(
                    name, p["code"], int(p["quantity"])
                )
            case "withdraw":
                _require(p, "code", "quantity")
                result = await client.withdraw_item(
                    name, p["code"], int(p["quantity"])
                )
            case "deposit_gold":
                _require(p, "quantity")
                result = await client.deposit_gold(name, int(p["quantity"]))
            case "withdraw_gold":
                _require(p, "quantity")
                result = await client.withdraw_gold(name, int(p["quantity"]))

            # --- Crafting ---
            case "craft":
                _require(p, "code")
                result = await client.craft(
                    name, p["code"], int(p.get("quantity", 1))
                )
            case "recycle":
                _require(p, "code")
                result = await client.recycle(
                    name, p["code"], int(p.get("quantity", 1))
                )

            # --- Grand Exchange ---
            case "ge_buy":
                _require(p, "id", "quantity")
                result = await client.ge_buy(
                    name, str(p["id"]), int(p["quantity"])
                )
            case "ge_create_buy":
                _require(p, "code", "quantity", "price")
                result = await client.ge_create_buy_order(
                    name, p["code"], int(p["quantity"]), int(p["price"])
                )
            case "ge_sell":
                _require(p, "code", "quantity", "price")
                result = await client.ge_sell_order(
                    name, p["code"], int(p["quantity"]), int(p["price"])
                )
            case "ge_fill":
                _require(p, "id", "quantity")
                result = await client.ge_fill_buy_order(
                    name, str(p["id"]), int(p["quantity"])
                )
            case "ge_cancel":
                _require(p, "order_id")
                result = await client.ge_cancel(name, p["order_id"])

            # --- Tasks ---
            case "task_new":
                result = await client.task_new(name)
            case "task_trade":
                _require(p, "code", "quantity")
                result = await client.task_trade(
                    name, p["code"], int(p["quantity"])
                )
            case "task_complete":
                result = await client.task_complete(name)
            case "task_exchange":
                result = await client.task_exchange(name)
            case "task_cancel":
                result = await client.task_cancel(name)

            # --- NPC ---
            case "npc_buy":
                _require(p, "code", "quantity")
                result = await client.npc_buy(
                    name, p["code"], int(p["quantity"])
                )
            case "npc_sell":
                _require(p, "code", "quantity")
                result = await client.npc_sell(
                    name, p["code"], int(p["quantity"])
                )

            case _:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown action: {body.action!r}",
                )
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"action": body.action, "character": name, "result": result}
