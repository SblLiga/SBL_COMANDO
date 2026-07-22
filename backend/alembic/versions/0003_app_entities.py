"""Add application tables and extend groups/users.

Revision ID: 0003
Revises: 0002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("target", sa.String(length=64), nullable=True))
    op.add_column("groups", sa.Column("gender", sa.String(length=16), nullable=True))
    op.add_column("groups", sa.Column("manager_name", sa.String(length=255), nullable=True))
    op.add_column("groups", sa.Column("manager_id", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("participant_count", sa.Integer(), server_default="0"))
    op.add_column("groups", sa.Column("max_participants", sa.Integer(), server_default="5"))
    op.add_column("groups", sa.Column("status", sa.String(length=32), server_default="on_track"))
    op.add_column("groups", sa.Column("avg_progress", sa.Float(), server_default="0"))

    op.add_column("users", sa.Column("email_verified", sa.Boolean(), server_default="false"))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=512), nullable=True))
    op.add_column("goals", sa.Column("reward_image", sa.String(length=512), nullable=True))

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("xp", sa.Float(), server_default="0"),
        sa.Column("streak", sa.Integer(), server_default="0"),
        sa.Column("gender", sa.String(length=16), nullable=True),
        sa.Column("target", sa.String(length=255), nullable=True),
        sa.Column("group_name", sa.String(length=255), nullable=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("progress", sa.Float(), server_default="0"),
        sa.Column("status", sa.String(length=64), server_default="בעקבות"),
        sa.Column("role", sa.String(length=32), server_default="user"),
        sa.Column("is_current_user", sa.Boolean(), server_default="false"),
        sa.Column("goal_title", sa.String(length=255), nullable=True),
        sa.Column("goal_id", sa.Integer(), nullable=True),
        sa.Column("goal_hidden", sa.Boolean(), server_default="false"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("next_month_target", sa.String(length=255), nullable=True),
        sa.Column("next_month_selected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goal_id", sa.Integer(), sa.ForeignKey("goals.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("order_index", sa.Integer(), server_default="0"),
        sa.Column("is_completed", sa.Boolean(), server_default="false"),
        sa.Column("priority", sa.String(length=32), server_default="בינוני"),
        sa.Column("xp_value", sa.Float(), server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=32), server_default="info"),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("is_handled", sa.Boolean(), server_default="false"),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "meetings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("group_name", sa.String(length=255), nullable=False),
        sa.Column("scheduled_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="scheduled"),
        sa.Column("current_section", sa.Integer(), server_default="0"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("section_reports", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), server_default="90"),
        sa.Column("is_locked", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending"),
        sa.Column("submitted_by", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("xp_task", sa.Float(), server_default="100"),
        sa.Column("xp_meeting", sa.Float(), server_default="150"),
        sa.Column("xp_goal", sa.Float(), server_default="500"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code", sa.String(length=8), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_table("system_settings")
    op.drop_table("reports")
    op.drop_table("meetings")
    op.drop_table("notifications")
    op.drop_table("tasks")
    op.drop_table("members")
    op.drop_column("goals", "reward_image")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "email_verified")
    for col in (
        "avg_progress",
        "status",
        "max_participants",
        "participant_count",
        "manager_id",
        "manager_name",
        "gender",
        "target",
    ):
        op.drop_column("groups", col)
