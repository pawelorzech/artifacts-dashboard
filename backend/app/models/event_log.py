from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EventLog(Base):
    """Logged game events for historical tracking and analytics."""

    __tablename__ = "event_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Type of event (e.g. 'combat', 'gathering', 'trade', 'level_up')",
    )
    event_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="Arbitrary JSON payload with event details",
    )
    character_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Character associated with the event (if applicable)",
    )
    map_x: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="X coordinate where the event occurred",
    )
    map_y: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Y coordinate where the event occurred",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<EventLog(id={self.id}, type={self.event_type!r}, "
            f"character={self.character_name!r})>"
        )
