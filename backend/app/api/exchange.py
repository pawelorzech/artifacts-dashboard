"""Grand Exchange API router."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from httpx import HTTPStatusError

from app.api.deps import get_user_client
from app.database import async_session_factory
from app.services.exchange_service import ExchangeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exchange", tags=["exchange"])


def _get_exchange_service(request: Request) -> ExchangeService:
    service: ExchangeService | None = getattr(request.app.state, "exchange_service", None)
    if service is None:
        raise HTTPException(
            status_code=503,
            detail="Exchange service is not available",
        )
    return service


@router.get("/orders")
async def browse_orders(
    request: Request,
    code: str | None = Query(default=None, description="Filter by item code"),
    type: str | None = Query(default=None, description="Filter by order type (sell or buy)"),
) -> dict[str, Any]:
    """Browse all active Grand Exchange orders (public market data)."""
    client = get_user_client(request)
    service = _get_exchange_service(request)

    try:
        orders = await service.browse_orders(client, code=code, order_type=type)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"orders": orders}


@router.get("/my-orders")
async def get_my_orders(request: Request) -> dict[str, Any]:
    """Get the authenticated account's own active GE orders."""
    client = get_user_client(request)
    service = _get_exchange_service(request)

    try:
        orders = await service.get_my_orders(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"orders": orders}


@router.get("/history")
async def get_history(request: Request) -> dict[str, Any]:
    """Get the authenticated account's GE transaction history."""
    client = get_user_client(request)
    service = _get_exchange_service(request)

    try:
        history = await service.get_history(client)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"history": history}


@router.get("/sell-history/{item_code}")
async def get_sell_history(item_code: str, request: Request) -> dict[str, Any]:
    """Get public sale history for a specific item (last 7 days from API)."""
    client = get_user_client(request)
    service = _get_exchange_service(request)

    try:
        history = await service.get_sell_history(client, item_code)
    except HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Artifacts API error: {exc.response.text}",
        ) from exc

    return {"item_code": item_code, "history": history}


@router.get("/prices/{item_code}")
async def get_price_history(
    item_code: str,
    request: Request,
    days: int = Query(default=7, ge=1, le=90, description="Number of days of history"),
) -> dict[str, Any]:
    """Get locally captured price history for a specific item."""
    service = _get_exchange_service(request)

    async with async_session_factory() as db:
        entries = await service.get_price_history(db, item_code, days)

    return {
        "item_code": item_code,
        "days": days,
        "entries": entries,
    }
