"""Add app_errors table for error tracking

Revision ID: 005_app_errors
Revises: 004_workflows
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "005_app_errors"
down_revision: Union[str, None] = "004_workflows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_errors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "severity",
            sa.String(length=20),
            nullable=False,
            server_default="error",
            comment="error | warning | critical",
        ),
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            comment="backend | frontend | automation | middleware",
        ),
        sa.Column(
            "error_type",
            sa.String(length=200),
            nullable=False,
            comment="Exception class name or error category",
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column(
            "context",
            sa.JSON(),
            nullable=True,
            comment="Arbitrary JSON context",
        ),
        sa.Column(
            "correlation_id",
            sa.String(length=36),
            nullable=True,
            comment="Request correlation ID",
        ),
        sa.Column(
            "resolved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_app_errors_correlation_id"),
        "app_errors",
        ["correlation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_app_errors_created_at"),
        "app_errors",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_app_errors_severity"),
        "app_errors",
        ["severity"],
        unique=False,
    )
    op.create_index(
        op.f("ix_app_errors_source"),
        "app_errors",
        ["source"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_app_errors_source"), table_name="app_errors")
    op.drop_index(op.f("ix_app_errors_severity"), table_name="app_errors")
    op.drop_index(op.f("ix_app_errors_created_at"), table_name="app_errors")
    op.drop_index(op.f("ix_app_errors_correlation_id"), table_name="app_errors")
    op.drop_table("app_errors")
