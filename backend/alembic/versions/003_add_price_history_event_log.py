"""Add price_history and event_log tables

Revision ID: 003_price_event
Revises: 002_automation
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003_price_event"
down_revision: Union[str, None] = "002_automation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # price_history
    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "item_code",
            sa.String(length=100),
            nullable=False,
            comment="Item code from the Artifacts API",
        ),
        sa.Column(
            "buy_price",
            sa.Float(),
            nullable=True,
            comment="Best buy price at capture time",
        ),
        sa.Column(
            "sell_price",
            sa.Float(),
            nullable=True,
            comment="Best sell price at capture time",
        ),
        sa.Column(
            "volume",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Trade volume at capture time",
        ),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Timestamp when the price was captured",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_price_history_item_code"),
        "price_history",
        ["item_code"],
        unique=False,
    )
    op.create_index(
        op.f("ix_price_history_captured_at"),
        "price_history",
        ["captured_at"],
        unique=False,
    )

    # event_log
    op.create_table(
        "event_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "event_type",
            sa.String(length=100),
            nullable=False,
            comment="Type of event (e.g. 'combat', 'gathering', 'trade', 'level_up')",
        ),
        sa.Column(
            "event_data",
            sa.JSON(),
            nullable=False,
            comment="Arbitrary JSON payload with event details",
        ),
        sa.Column(
            "character_name",
            sa.String(length=100),
            nullable=True,
            comment="Character associated with the event (if applicable)",
        ),
        sa.Column(
            "map_x",
            sa.Integer(),
            nullable=True,
            comment="X coordinate where the event occurred",
        ),
        sa.Column(
            "map_y",
            sa.Integer(),
            nullable=True,
            comment="Y coordinate where the event occurred",
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
        op.f("ix_event_log_event_type"),
        "event_log",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_log_character_name"),
        "event_log",
        ["character_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_log_created_at"),
        "event_log",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_event_log_created_at"), table_name="event_log")
    op.drop_index(op.f("ix_event_log_character_name"), table_name="event_log")
    op.drop_index(op.f("ix_event_log_event_type"), table_name="event_log")
    op.drop_table("event_log")
    op.drop_index(op.f("ix_price_history_captured_at"), table_name="price_history")
    op.drop_index(op.f("ix_price_history_item_code"), table_name="price_history")
    op.drop_table("price_history")
