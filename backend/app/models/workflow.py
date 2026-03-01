from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WorkflowConfig(Base):
    __tablename__ = "workflow_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    character_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    steps: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON array of workflow steps, each with id, name, strategy_type, config, transition",
    )
    loop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_loops: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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

    runs: Mapped[list["WorkflowRun"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowRun.started_at.desc()",
    )

    def __repr__(self) -> str:
        return (
            f"<WorkflowConfig(id={self.id}, name={self.name!r}, "
            f"character={self.character_name!r}, steps={len(self.steps)})>"
        )


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("workflow_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running",
        comment="Status: running, paused, stopped, completed, error",
    )
    current_step_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_step_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    loop_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_actions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    step_actions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    stopped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    step_history: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON array of completed step records",
    )

    workflow: Mapped["WorkflowConfig"] = relationship(back_populates="runs")

    def __repr__(self) -> str:
        return (
            f"<WorkflowRun(id={self.id}, workflow_id={self.workflow_id}, "
            f"status={self.status!r}, step={self.current_step_index})>"
        )
