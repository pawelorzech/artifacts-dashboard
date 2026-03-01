"""Shared action execution logic.

Dispatches an ``ActionPlan`` to the appropriate ``ArtifactsClient`` method.
Used by ``AutomationRunner``, ``WorkflowRunner``, and ``CharacterWorker``
so the match statement is defined in exactly one place.
"""

from __future__ import annotations

import logging
from typing import Any

from app.engine.strategies.base import ActionPlan, ActionType
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)


async def execute_action(
    client: ArtifactsClient,
    character_name: str,
    plan: ActionPlan,
) -> dict[str, Any]:
    """Execute an action plan against the game API and return the raw result."""
    match plan.action_type:
        case ActionType.MOVE:
            return await client.move(
                character_name,
                plan.params["x"],
                plan.params["y"],
            )
        case ActionType.FIGHT:
            return await client.fight(character_name)
        case ActionType.GATHER:
            return await client.gather(character_name)
        case ActionType.REST:
            return await client.rest(character_name)
        case ActionType.EQUIP:
            return await client.equip(
                character_name,
                plan.params["code"],
                plan.params["slot"],
                plan.params.get("quantity", 1),
            )
        case ActionType.UNEQUIP:
            return await client.unequip(
                character_name,
                plan.params["slot"],
                plan.params.get("quantity", 1),
            )
        case ActionType.USE_ITEM:
            return await client.use_item(
                character_name,
                plan.params["code"],
                plan.params.get("quantity", 1),
            )
        case ActionType.DEPOSIT_ITEM:
            return await client.deposit_item(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
            )
        case ActionType.WITHDRAW_ITEM:
            return await client.withdraw_item(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
            )
        case ActionType.CRAFT:
            return await client.craft(
                character_name,
                plan.params["code"],
                plan.params.get("quantity", 1),
            )
        case ActionType.RECYCLE:
            return await client.recycle(
                character_name,
                plan.params["code"],
                plan.params.get("quantity", 1),
            )
        case ActionType.GE_BUY:
            return await client.ge_buy(
                character_name,
                plan.params["id"],
                plan.params["quantity"],
            )
        case ActionType.GE_CREATE_BUY:
            return await client.ge_create_buy_order(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
                plan.params["price"],
            )
        case ActionType.GE_SELL:
            return await client.ge_sell_order(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
                plan.params["price"],
            )
        case ActionType.GE_FILL:
            return await client.ge_fill_buy_order(
                character_name,
                plan.params["id"],
                plan.params["quantity"],
            )
        case ActionType.GE_CANCEL:
            return await client.ge_cancel(
                character_name,
                plan.params["order_id"],
            )
        case ActionType.TASK_NEW:
            return await client.task_new(character_name)
        case ActionType.TASK_TRADE:
            return await client.task_trade(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
            )
        case ActionType.TASK_COMPLETE:
            return await client.task_complete(character_name)
        case ActionType.TASK_EXCHANGE:
            return await client.task_exchange(character_name)
        case ActionType.TASK_CANCEL:
            return await client.task_cancel(character_name)
        case ActionType.DEPOSIT_GOLD:
            return await client.deposit_gold(
                character_name,
                plan.params["quantity"],
            )
        case ActionType.WITHDRAW_GOLD:
            return await client.withdraw_gold(
                character_name,
                plan.params["quantity"],
            )
        case ActionType.NPC_BUY:
            return await client.npc_buy(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
            )
        case ActionType.NPC_SELL:
            return await client.npc_sell(
                character_name,
                plan.params["code"],
                plan.params["quantity"],
            )
        case _:
            logger.warning("Unhandled action type: %s", plan.action_type)
            return {}
