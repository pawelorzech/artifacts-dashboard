import asyncio
import logging
import time
from collections import deque
from typing import Any

import httpx

from app.config import settings
from app.schemas.game import (
    CharacterSchema,
    ItemSchema,
    MapSchema,
    MonsterSchema,
    ResourceSchema,
)

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token-bucket style rate limiter using a sliding window of timestamps."""

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self._max_requests = max_requests
        self._window = window_seconds
        self._timestamps: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()

            # Evict timestamps outside the current window
            while self._timestamps and self._timestamps[0] <= now - self._window:
                self._timestamps.popleft()

            if len(self._timestamps) >= self._max_requests:
                # Wait until the oldest timestamp exits the window
                sleep_duration = self._window - (now - self._timestamps[0])
                if sleep_duration > 0:
                    await asyncio.sleep(sleep_duration)

                # Re-evict after sleeping
                now = time.monotonic()
                while self._timestamps and self._timestamps[0] <= now - self._window:
                    self._timestamps.popleft()

            self._timestamps.append(time.monotonic())


class ArtifactsClient:
    """Async HTTP client for the Artifacts MMO API.

    Handles authentication, rate limiting, pagination, and retry logic.
    """

    MAX_RETRIES: int = 3
    RETRY_BASE_DELAY: float = 1.0

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=settings.artifacts_api_url,
            headers={
                "Authorization": f"Bearer {settings.artifacts_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        self._action_limiter = RateLimiter(
            max_requests=settings.action_rate_limit,
            window_seconds=settings.action_rate_window,
        )
        self._data_limiter = RateLimiter(
            max_requests=settings.data_rate_limit,
            window_seconds=settings.data_rate_window,
        )

    # ------------------------------------------------------------------
    # Low-level request helpers
    # ------------------------------------------------------------------

    async def _request(
        self,
        method: str,
        path: str,
        *,
        limiter: RateLimiter,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        last_exc: Exception | None = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            await limiter.acquire()
            try:
                response = await self._client.request(
                    method,
                    path,
                    json=json_body,
                    params=params,
                )

                if response.status_code == 429:
                    retry_after = float(response.headers.get("Retry-After", "2"))
                    logger.warning(
                        "Rate limited on %s %s, retrying after %.1fs",
                        method,
                        path,
                        retry_after,
                    )
                    await asyncio.sleep(retry_after)
                    continue

                if response.status_code >= 500:
                    logger.warning(
                        "Server error %d on %s %s (attempt %d/%d)",
                        response.status_code,
                        method,
                        path,
                        attempt,
                        self.MAX_RETRIES,
                    )
                    if attempt < self.MAX_RETRIES:
                        delay = self.RETRY_BASE_DELAY * (2 ** (attempt - 1))
                        await asyncio.sleep(delay)
                        continue
                    response.raise_for_status()

                response.raise_for_status()
                return response.json()

            except httpx.HTTPStatusError:
                raise
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_exc = exc
                logger.warning(
                    "Network error on %s %s (attempt %d/%d): %s",
                    method,
                    path,
                    attempt,
                    self.MAX_RETRIES,
                    exc,
                )
                if attempt < self.MAX_RETRIES:
                    delay = self.RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    await asyncio.sleep(delay)
                    continue

        raise last_exc or RuntimeError(f"Request failed after {self.MAX_RETRIES} retries")

    async def _get(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._request(
            "GET",
            path,
            limiter=self._data_limiter,
            params=params,
        )

    async def _post_action(
        self,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await self._request(
            "POST",
            path,
            limiter=self._action_limiter,
            json_body=json_body,
        )

    async def _get_paginated(
        self,
        path: str,
        page_size: int = 100,
    ) -> list[dict[str, Any]]:
        """Fetch all pages from a paginated endpoint."""
        all_items: list[dict[str, Any]] = []
        page = 1

        while True:
            result = await self._get(path, params={"page": page, "size": page_size})
            data = result.get("data", [])
            all_items.extend(data)

            total_pages = result.get("pages", 1)
            if page >= total_pages:
                break
            page += 1

        return all_items

    # ------------------------------------------------------------------
    # Data endpoints - Characters
    # ------------------------------------------------------------------

    async def get_characters(self) -> list[CharacterSchema]:
        result = await self._get("/my/characters")
        data = result.get("data", [])
        return [CharacterSchema.model_validate(c) for c in data]

    async def get_character(self, name: str) -> CharacterSchema:
        result = await self._get(f"/characters/{name}")
        return CharacterSchema.model_validate(result["data"])

    # ------------------------------------------------------------------
    # Data endpoints - Items
    # ------------------------------------------------------------------

    async def get_items(self, page: int = 1, size: int = 100) -> list[ItemSchema]:
        result = await self._get("/items", params={"page": page, "size": size})
        return [ItemSchema.model_validate(i) for i in result.get("data", [])]

    async def get_all_items(self) -> list[ItemSchema]:
        raw = await self._get_paginated("/items")
        return [ItemSchema.model_validate(i) for i in raw]

    # ------------------------------------------------------------------
    # Data endpoints - Monsters
    # ------------------------------------------------------------------

    async def get_monsters(self, page: int = 1, size: int = 100) -> list[MonsterSchema]:
        result = await self._get("/monsters", params={"page": page, "size": size})
        return [MonsterSchema.model_validate(m) for m in result.get("data", [])]

    async def get_all_monsters(self) -> list[MonsterSchema]:
        raw = await self._get_paginated("/monsters")
        return [MonsterSchema.model_validate(m) for m in raw]

    # ------------------------------------------------------------------
    # Data endpoints - Resources
    # ------------------------------------------------------------------

    async def get_resources(self, page: int = 1, size: int = 100) -> list[ResourceSchema]:
        result = await self._get("/resources", params={"page": page, "size": size})
        return [ResourceSchema.model_validate(r) for r in result.get("data", [])]

    async def get_all_resources(self) -> list[ResourceSchema]:
        raw = await self._get_paginated("/resources")
        return [ResourceSchema.model_validate(r) for r in raw]

    # ------------------------------------------------------------------
    # Data endpoints - Maps
    # ------------------------------------------------------------------

    async def get_maps(
        self,
        page: int = 1,
        size: int = 100,
        content_type: str | None = None,
        content_code: str | None = None,
    ) -> list[MapSchema]:
        params: dict[str, Any] = {"page": page, "size": size}
        if content_type is not None:
            params["content_type"] = content_type
        if content_code is not None:
            params["content_code"] = content_code
        result = await self._get("/maps", params=params)
        return [MapSchema.model_validate(m) for m in result.get("data", [])]

    async def get_all_maps(self) -> list[MapSchema]:
        raw = await self._get_paginated("/maps")
        return [MapSchema.model_validate(m) for m in raw]

    # ------------------------------------------------------------------
    # Data endpoints - Events, Bank, GE
    # ------------------------------------------------------------------

    async def get_events(self) -> list[dict[str, Any]]:
        result = await self._get("/events")
        return result.get("data", [])

    async def get_bank_items(self, page: int = 1, size: int = 100) -> list[dict[str, Any]]:
        result = await self._get("/my/bank/items", params={"page": page, "size": size})
        return result.get("data", [])

    async def get_all_bank_items(self) -> list[dict[str, Any]]:
        return await self._get_paginated("/my/bank/items")

    async def get_bank_details(self) -> dict[str, Any]:
        result = await self._get("/my/bank")
        return result.get("data", {})

    async def get_ge_orders(self) -> list[dict[str, Any]]:
        result = await self._get("/my/grandexchange/orders")
        return result.get("data", [])

    async def get_ge_history(self) -> list[dict[str, Any]]:
        result = await self._get("/my/grandexchange/history")
        return result.get("data", [])

    # ------------------------------------------------------------------
    # Action endpoints
    # ------------------------------------------------------------------

    async def move(self, name: str, x: int, y: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/move",
            json_body={"x": x, "y": y},
        )
        return result.get("data", {})

    async def fight(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/fight")
        return result.get("data", {})

    async def gather(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/gathering")
        return result.get("data", {})

    async def rest(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/rest")
        return result.get("data", {})

    async def equip(
        self, name: str, code: str, slot: str, quantity: int = 1
    ) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/equip",
            json_body={"code": code, "slot": slot, "quantity": quantity},
        )
        return result.get("data", {})

    async def unequip(self, name: str, slot: str, quantity: int = 1) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/unequip",
            json_body={"slot": slot, "quantity": quantity},
        )
        return result.get("data", {})

    async def use_item(self, name: str, code: str, quantity: int = 1) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/use",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def deposit_item(self, name: str, code: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/bank/deposit",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def withdraw_item(self, name: str, code: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/bank/withdraw",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def deposit_gold(self, name: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/bank/deposit/gold",
            json_body={"quantity": quantity},
        )
        return result.get("data", {})

    async def withdraw_gold(self, name: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/bank/withdraw/gold",
            json_body={"quantity": quantity},
        )
        return result.get("data", {})

    async def craft(self, name: str, code: str, quantity: int = 1) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/crafting",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def recycle(self, name: str, code: str, quantity: int = 1) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/recycling",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def ge_buy(
        self, name: str, code: str, quantity: int, price: int
    ) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/grandexchange/buy",
            json_body={"code": code, "quantity": quantity, "price": price},
        )
        return result.get("data", {})

    async def ge_sell_order(
        self, name: str, code: str, quantity: int, price: int
    ) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/grandexchange/sell",
            json_body={"code": code, "quantity": quantity, "price": price},
        )
        return result.get("data", {})

    async def ge_buy_order(
        self, name: str, code: str, quantity: int, price: int
    ) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/grandexchange/buy",
            json_body={"code": code, "quantity": quantity, "price": price},
        )
        return result.get("data", {})

    async def ge_cancel(self, name: str, order_id: str) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/grandexchange/cancel",
            json_body={"id": order_id},
        )
        return result.get("data", {})

    async def task_new(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/task/new")
        return result.get("data", {})

    async def task_trade(
        self, name: str, code: str, quantity: int
    ) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/task/trade",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def task_complete(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/task/complete")
        return result.get("data", {})

    async def task_exchange(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/task/exchange")
        return result.get("data", {})

    async def task_cancel(self, name: str) -> dict[str, Any]:
        result = await self._post_action(f"/my/{name}/action/task/cancel")
        return result.get("data", {})

    async def npc_buy(self, name: str, code: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/npc/buy",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    async def npc_sell(self, name: str, code: str, quantity: int) -> dict[str, Any]:
        result = await self._post_action(
            f"/my/{name}/action/npc/sell",
            json_body={"code": code, "quantity": quantity},
        )
        return result.get("data", {})

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        await self._client.aclose()
