from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PipelineConfig(Base):
    __tablename__ = "pipeline_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stages: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON array of pipeline stages, each with id, name, character_steps[]",
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

    runs: Mapped[list["PipelineRun"]] = relationship(
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineRun.started_at.desc()",
    )

    def __repr__(self) -> str:
        return (
            f"<PipelineConfig(id={self.id}, name={self.name!r}, "
            f"stages={len(self.stages)})>"
        )


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pipeline_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running",
        comment="Status: running, paused, stopped, completed, error",
    )
    current_stage_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_stage_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    loop_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_actions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    character_states: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="Per-character state: {char_name: {status, step_id, actions_count, error}}",
    )
    stage_history: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="JSON array of completed stage records",
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
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    pipeline: Mapped["PipelineConfig"] = relationship(back_populates="runs")

    def __repr__(self) -> str:
        return (
            f"<PipelineRun(id={self.id}, pipeline_id={self.pipeline_id}, "
            f"status={self.status!r}, stage={self.current_stage_index})>"
        )
