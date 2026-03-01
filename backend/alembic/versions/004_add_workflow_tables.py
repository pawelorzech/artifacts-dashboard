"""Add workflow_configs, workflow_runs tables

Revision ID: 004_workflows
Revises: 003_price_event
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "004_workflows"
down_revision: Union[str, None] = "003_price_event"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # workflow_configs
    op.create_table(
        "workflow_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("character_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column(
            "steps",
            sa.JSON(),
            nullable=False,
            comment="JSON array of workflow steps",
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
    op.create_index(
        op.f("ix_workflow_configs_character_name"),
        "workflow_configs",
        ["character_name"],
        unique=False,
    )

    # workflow_runs
    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "workflow_id",
            sa.Integer(),
            sa.ForeignKey("workflow_configs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'running'"),
            comment="Status: running, paused, stopped, completed, error",
        ),
        sa.Column("current_step_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "current_step_id",
            sa.String(length=100),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column("loop_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_actions_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("step_actions_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "step_history",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
            comment="JSON array of completed step records",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_workflow_runs_workflow_id"),
        "workflow_runs",
        ["workflow_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_workflow_runs_workflow_id"), table_name="workflow_runs")
    op.drop_table("workflow_runs")
    op.drop_index(op.f("ix_workflow_configs_character_name"), table_name="workflow_configs")
    op.drop_table("workflow_configs")
