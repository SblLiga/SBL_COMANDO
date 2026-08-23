"""Add manager next-month cycle plan fields on members.

Revision ID: 0011
Revises: 0010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("members", sa.Column("next_month_zone", sa.String(length=16), nullable=True))
    op.add_column("members", sa.Column("next_month_tasks", sa.JSON(), nullable=True))
    op.add_column("members", sa.Column("next_month_reward", sa.String(length=512), nullable=True))
    op.add_column(
        "members",
        sa.Column("next_month_reward_image", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("members", "next_month_reward_image")
    op.drop_column("members", "next_month_reward")
    op.drop_column("members", "next_month_tasks")
    op.drop_column("members", "next_month_zone")
