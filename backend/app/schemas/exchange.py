"""Pydantic schemas for Grand Exchange responses."""

from datetime import datetime

from pydantic import BaseModel, Field


class OrderResponse(BaseModel):
    """A single GE order."""

    id: str = ""
    code: str = ""
    quantity: int = 0
    price: int = 0
    order: str = Field(default="", description="Order type: 'buy' or 'sell'")
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PriceHistoryResponse(BaseModel):
    """A single price history entry."""

    id: int
    item_code: str
    buy_price: float | None = None
    sell_price: float | None = None
    volume: int = 0
    captured_at: datetime | None = None

    model_config = {"from_attributes": True}


class PriceHistoryListResponse(BaseModel):
    """Response for price history queries."""

    item_code: str
    days: int
    entries: list[PriceHistoryResponse] = Field(default_factory=list)


class ExchangeOrdersResponse(BaseModel):
    """Response wrapping a list of GE orders."""

    orders: list[dict] = Field(default_factory=list)


class ExchangeHistoryResponse(BaseModel):
    """Response wrapping GE transaction history."""

    history: list[dict] = Field(default_factory=list)
