"""Create game_data_cache and character_snapshots tables

Revision ID: 001_initial
Revises:
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # game_data_cache
    op.create_table(
        "game_data_cache",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "data_type",
            sa.String(length=50),
            nullable=False,
            comment=(
                "Type of cached data: items, monsters, resources, maps, "
                "events, achievements, npcs, tasks, effects, badges"
            ),
        ),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("data_type", name="uq_game_data_cache_data_type"),
    )

    # character_snapshots
    op.create_table(
        "character_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_character_snapshots_name"),
        "character_snapshots",
        ["name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_character_snapshots_name"),
        table_name="character_snapshots",
    )
    op.drop_table("character_snapshots")
    op.drop_table("game_data_cache")
