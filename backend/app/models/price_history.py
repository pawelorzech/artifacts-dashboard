from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PriceHistory(Base):
    """Captured Grand Exchange price snapshots over time."""

    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_code: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Item code from the Artifacts API",
    )
    buy_price: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Best buy price at capture time",
    )
    sell_price: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Best sell price at capture time",
    )
    volume: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Trade volume at capture time",
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Timestamp when the price was captured",
    )

    def __repr__(self) -> str:
        return (
            f"<PriceHistory(id={self.id}, item={self.item_code!r}, "
            f"buy={self.buy_price}, sell={self.sell_price})>"
        )
