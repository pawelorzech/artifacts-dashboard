"""Add pipeline_configs, pipeline_runs tables for multi-character pipelines

Revision ID: 006_pipelines
Revises: 005_app_errors
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "006_pipelines"
down_revision: Union[str, None] = "005_app_errors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pipeline_configs
    op.create_table(
        "pipeline_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column(
            "stages",
            sa.JSON(),
            nullable=False,
            comment="JSON array of pipeline stages with character_steps",
        ),
        sa.Column("loop", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("max_loops", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # pipeline_runs
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "pipeline_id",
            sa.Integer(),
            sa.ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'running'"),
            comment="Status: running, paused, stopped, completed, error",
        ),
        sa.Column("current_stage_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "current_stage_id",
            sa.String(length=100),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column("loop_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_actions_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "character_states",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
            comment="Per-character state JSON",
        ),
        sa.Column(
            "stage_history",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
            comment="JSON array of completed stage records",
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pipeline_runs_pipeline_id"),
        "pipeline_runs",
        ["pipeline_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pipeline_runs_pipeline_id"), table_name="pipeline_runs")
    op.drop_table("pipeline_runs")
    op.drop_table("pipeline_configs")
