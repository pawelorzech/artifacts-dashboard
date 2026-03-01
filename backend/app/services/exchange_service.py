"""Grand Exchange service for orders, history, and price tracking."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.price_history import PriceHistory
from app.services.artifacts_client import ArtifactsClient

logger = logging.getLogger(__name__)

# Default interval for price capture background task (5 minutes)
_PRICE_CAPTURE_INTERVAL: float = 5 * 60


class ExchangeService:
    """High-level service for Grand Exchange operations and price tracking."""

    def __init__(self) -> None:
        self._capture_task: asyncio.Task[None] | None = None

    # ------------------------------------------------------------------
    # Order and history queries (pass-through to API with enrichment)
    # ------------------------------------------------------------------

    async def browse_orders(
        self,
        client: ArtifactsClient,
        code: str | None = None,
        order_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Browse all active GE orders on the market (public).

        Returns
        -------
        List of order dicts from the Artifacts API.
        """
        return await client.browse_ge_orders(code=code, order_type=order_type)

    async def get_my_orders(self, client: ArtifactsClient) -> list[dict[str, Any]]:
        """Get the authenticated account's own active GE orders.

        Returns
        -------
        List of order dicts from the Artifacts API.
        """
        return await client.get_ge_orders()

    async def get_history(self, client: ArtifactsClient) -> list[dict[str, Any]]:
        """Get GE transaction history for the account.

        Returns
        -------
        List of history entry dicts from the Artifacts API.
        """
        return await client.get_ge_history()

    async def get_sell_history(
        self, client: ArtifactsClient, item_code: str
    ) -> list[dict[str, Any]]:
        """Get public sale history for a specific item.

        Returns
        -------
        List of sale history dicts from the Artifacts API.
        """
        return await client.get_ge_sell_history(item_code)

    # ------------------------------------------------------------------
    # Price capture
    # ------------------------------------------------------------------

    async def capture_prices(
        self,
        db: AsyncSession,
        client: ArtifactsClient,
    ) -> int:
        """Snapshot current GE prices to the price_history table.

        Captures both buy and sell orders to derive best prices.

        Returns
        -------
        Number of price entries captured.
        """
        try:
            orders = await client.browse_ge_orders()
        except Exception:
            logger.exception("Failed to fetch GE orders for price capture")
            return 0

        if not orders:
            logger.debug("No GE orders to capture prices from")
            return 0

        # Aggregate prices by item_code
        item_prices: dict[str, dict[str, Any]] = {}
        for order in orders:
            code = order.get("code", "")
            if not code:
                continue

            if code not in item_prices:
                item_prices[code] = {
                    "buy_price": None,
                    "sell_price": None,
                    "volume": 0,
                }

            price = order.get("price", 0)
            quantity = order.get("quantity", 0)
            order_type = order.get("type", "")  # "buy" or "sell"

            item_prices[code]["volume"] += quantity

            if order_type == "buy":
                current_buy = item_prices[code]["buy_price"]
                if current_buy is None or price > current_buy:
                    item_prices[code]["buy_price"] = price
            elif order_type == "sell":
                current_sell = item_prices[code]["sell_price"]
                if current_sell is None or price < current_sell:
                    item_prices[code]["sell_price"] = price

        # Insert price history records
        count = 0
        for code, prices in item_prices.items():
            entry = PriceHistory(
                item_code=code,
                buy_price=prices["buy_price"],
                sell_price=prices["sell_price"],
                volume=prices["volume"],
            )
            db.add(entry)
            count += 1

        await db.commit()
        logger.info("Captured %d price entries from GE", count)
        return count

    async def get_price_history(
        self,
        db: AsyncSession,
        item_code: str,
        days: int = 7,
    ) -> list[dict[str, Any]]:
        """Get price history for an item over the specified number of days.

        Parameters
        ----------
        db:
            Database session.
        item_code:
            The item code to query.
        days:
            How many days of history to return (default 7).

        Returns
        -------
        List of price history dicts ordered by captured_at ascending.
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(PriceHistory)
            .where(
                PriceHistory.item_code == item_code,
                PriceHistory.captured_at >= since,
            )
            .order_by(PriceHistory.captured_at.asc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        return [
            {
                "id": row.id,
                "item_code": row.item_code,
                "buy_price": row.buy_price,
                "sell_price": row.sell_price,
                "volume": row.volume,
                "captured_at": row.captured_at.isoformat() if row.captured_at else None,
            }
            for row in rows
        ]

    # ------------------------------------------------------------------
    # Background price capture task
    # ------------------------------------------------------------------

    def start_price_capture(
        self,
        db_factory: async_sessionmaker[AsyncSession],
        client: ArtifactsClient,
        interval_seconds: float = _PRICE_CAPTURE_INTERVAL,
    ) -> asyncio.Task[None]:
        """Spawn a background task that captures GE prices periodically.

        Parameters
        ----------
        db_factory:
            Async session factory for database access.
        client:
            Artifacts API client.
        interval_seconds:
            How often to capture prices (default 5 minutes).

        Returns
        -------
        The created asyncio Task.
        """

        async def _loop() -> None:
            while True:
                try:
                    async with db_factory() as db:
                        await self.capture_prices(db, client)
                except asyncio.CancelledError:
                    logger.info("Price capture background task cancelled")
                    return
                except Exception:
                    logger.exception("Unhandled error during price capture")
                await asyncio.sleep(interval_seconds)

        self._capture_task = asyncio.create_task(_loop())
        return self._capture_task

    def stop_price_capture(self) -> None:
        """Cancel the background price capture task."""
        if self._capture_task is not None and not self._capture_task.done():
            self._capture_task.cancel()
