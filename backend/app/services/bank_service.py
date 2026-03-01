"""Bank service providing enriched bank data with item details."""

import logging
from typing import Any

from app.schemas.game import ItemSchema
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)


class BankService:
    """High-level service for bank operations with enriched data."""

    async def get_contents(
        self,
        client: ArtifactsClient,
        items_cache: list[ItemSchema] | None = None,
    ) -> dict[str, Any]:
        """Return bank contents enriched with item details from the cache.

        Parameters
        ----------
        client:
            The artifacts API client.
        items_cache:
            Optional list of all items from the game data cache.
            If provided, bank items are enriched with name, type, level, etc.

        Returns
        -------
        Dict with "details" (bank metadata) and "items" (enriched item list).
        """
        details = await client.get_bank_details()
        raw_items = await client.get_all_bank_items()

        # Build item lookup if cache is provided
        item_lookup: dict[str, ItemSchema] = {}
        if items_cache:
            item_lookup = {item.code: item for item in items_cache}

        enriched_items: list[dict[str, Any]] = []
        for bank_item in raw_items:
            code = bank_item.get("code", "")
            quantity = bank_item.get("quantity", 0)

            enriched: dict[str, Any] = {
                "code": code,
                "quantity": quantity,
            }

            # Enrich with item details if available
            item_data = item_lookup.get(code)
            if item_data is not None:
                enriched["name"] = item_data.name
                enriched["type"] = item_data.type
                enriched["subtype"] = item_data.subtype
                enriched["level"] = item_data.level
                enriched["description"] = item_data.description
                enriched["effects"] = [
                    {"name": e.name, "value": e.value}
                    for e in item_data.effects
                ]
            else:
                enriched["name"] = code
                enriched["type"] = ""
                enriched["subtype"] = ""
                enriched["level"] = 0
                enriched["description"] = ""
                enriched["effects"] = []

            enriched_items.append(enriched)

        return {
            "details": details,
            "items": enriched_items,
        }

    async def get_summary(
        self,
        client: ArtifactsClient,
    ) -> dict[str, Any]:
        """Return a summary of bank contents: gold, item count, total slots.

        Returns
        -------
        Dict with "gold", "item_count", "used_slots", and "total_slots".
        """
        details = await client.get_bank_details()
        raw_items = await client.get_all_bank_items()

        gold = details.get("gold", 0)
        total_slots = details.get("slots", 0)
        used_slots = len(raw_items)
        item_count = sum(item.get("quantity", 0) for item in raw_items)

        return {
            "gold": gold,
            "item_count": item_count,
            "used_slots": used_slots,
            "total_slots": total_slots,
        }
