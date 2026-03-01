"""Add user_token_hash column to app_errors for per-user scoping

Revision ID: 007_user_token_hash
Revises: 006_pipelines
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "007_user_token_hash"
down_revision: Union[str, None] = "006_pipelines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_errors",
        sa.Column(
            "user_token_hash",
            sa.String(length=64),
            nullable=True,
            comment="SHA-256 hash of the user API token",
        ),
    )
    op.create_index(
        op.f("ix_app_errors_user_token_hash"),
        "app_errors",
        ["user_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_app_errors_user_token_hash"), table_name="app_errors")
    op.drop_column("app_errors", "user_token_hash")
