from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AutomationConfig(Base):
    __tablename__ = "automation_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    character_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    strategy_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Strategy type: combat, gathering, crafting, trading, task, leveling",
    )
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    runs: Mapped[list["AutomationRun"]] = relationship(
        back_populates="config",
        cascade="all, delete-orphan",
        order_by="AutomationRun.started_at.desc()",
    )

    def __repr__(self) -> str:
        return (
            f"<AutomationConfig(id={self.id}, name={self.name!r}, "
            f"character={self.character_name!r}, strategy={self.strategy_type!r})>"
        )


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("automation_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running",
        comment="Status: running, paused, stopped, completed, error",
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    actions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    config: Mapped["AutomationConfig"] = relationship(back_populates="runs")
    logs: Mapped[list["AutomationLog"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AutomationLog.created_at.desc()",
    )

    def __repr__(self) -> str:
        return (
            f"<AutomationRun(id={self.id}, config_id={self.config_id}, "
            f"status={self.status!r})>"
        )


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("automation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    success: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    run: Mapped["AutomationRun"] = relationship(back_populates="logs")

    def __repr__(self) -> str:
        return (
            f"<AutomationLog(id={self.id}, run_id={self.run_id}, "
            f"action={self.action_type!r}, success={self.success})>"
        )
