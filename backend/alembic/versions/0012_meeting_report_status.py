"""Add meeting report_status and report.meeting_id for approval flow.

Revision ID: 0012
Revises: 0011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("report_status", sa.String(length=32), nullable=True))
    op.add_column("reports", sa.Column("meeting_id", sa.Integer(), nullable=True))
    # Backfill: locked completed meetings were already sent → pending; unlocked → draft.
    op.execute(
        """
        UPDATE meetings
        SET report_status = CASE
            WHEN status = 'completed' AND is_locked IS TRUE THEN 'pending'
            WHEN status = 'completed' THEN 'draft'
            ELSE report_status
        END
        WHERE status = 'completed' AND report_status IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("reports", "meeting_id")
    op.drop_column("meetings", "report_status")
