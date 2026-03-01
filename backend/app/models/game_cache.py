from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GameDataCache(Base):
    __tablename__ = "game_data_cache"
    __table_args__ = (
        UniqueConstraint("data_type", name="uq_game_data_cache_data_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    data_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of cached data: items, monsters, resources, maps, events, "
        "achievements, npcs, tasks, effects, badges",
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<GameDataCache(id={self.id}, data_type={self.data_type!r})>"
