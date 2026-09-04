import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.admin import promote_user_immediately, require_admin_without_auth_side_effects
from app.models import Base, Goal, Group, Member, User


OUTSIDE_MANAGER_WINDOW = datetime(2026, 9, 4, 9, 0, tzinfo=timezone.utc)
INSIDE_MANAGER_WINDOW = datetime(2026, 9, 23, 9, 0, tzinfo=timezone.utc)


class MidMonthPromotionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def seed_target(self, *, participant_count=3, with_group=True, member_count=1):
        group = Group(
            name="existing-group",
            manager_id=900,
            manager_name="Existing Manager",
            participant_count=participant_count,
        )
        self.db.add(group)
        self.db.flush()

        user = User(
            email="target@example.com",
            password_hash="hash",
            full_name="Target User",
            role="user",
            pending_manager=False,
            pending_demotion=False,
            subscription_status="active",
            onboarding_completed=True,
            is_active=True,
            group_id=group.id if with_group else None,
        )
        self.db.add(user)
        self.db.flush()

        goal = Goal(
            title="Existing goal",
            target="sales",
            cycle_month="legacy-cycle",
            progress=64.0,
            xp_total=725.0,
            streak=11,
            owner_user_id=user.id,
        )
        self.db.add(goal)
        self.db.flush()

        members = []
        for index in range(member_count):
            member = Member(
                name=f"Target Member {index}",
                user_id=user.id,
                role="user",
                group_id=group.id if with_group else None,
                group_name=group.name if with_group else None,
                xp=725.0,
                progress=64.0,
                streak=11,
                goal_id=goal.id,
                goal_title=goal.title,
            )
            self.db.add(member)
            members.append(member)
        self.db.commit()
        return user, members, group, goal

    def test_success_preserves_stats_and_goal_and_decrements_group(self):
        user, members, group, goal = self.seed_target()
        before = (
            members[0].xp,
            members[0].progress,
            members[0].streak,
            members[0].goal_id,
            members[0].goal_title,
        )

        with self.assertLogs("app.api.admin", level="INFO") as captured:
            result = promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=OUTSIDE_MANAGER_WINDOW,
            )
            self.db.commit()

        self.db.refresh(user)
        self.db.refresh(members[0])
        self.db.refresh(group)
        self.db.refresh(goal)
        self.assertEqual(user.role, "manager")
        self.assertIsNone(user.group_id)
        self.assertEqual(members[0].role, "manager")
        self.assertIsNone(members[0].group_id)
        self.assertIsNone(members[0].group_name)
        self.assertEqual(
            before,
            (
                members[0].xp,
                members[0].progress,
                members[0].streak,
                members[0].goal_id,
                members[0].goal_title,
            ),
        )
        self.assertEqual(group.participant_count, 2)
        self.assertEqual((goal.xp_total, goal.progress, goal.streak), (725.0, 64.0, 11))
        self.assertEqual(goal.cycle_month, "2026-09")
        self.assertFalse(result["manager_goal_selection"]["reset_stats"])
        log_text = "\n".join(captured.output)
        self.assertIn('action="mid_month_promotion"', log_text)
        self.assertIn("actor_admin_id=42", log_text)
        self.assertIn(f"target_user_id={user.id}", log_text)

    def test_duplicate_members_are_rejected_without_writes(self):
        user, members, group, _goal = self.seed_target(member_count=2)

        with self.assertRaises(HTTPException) as raised:
            promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=OUTSIDE_MANAGER_WINDOW,
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("בדיקה ידנית", raised.exception.detail)
        self.assertEqual(user.role, "user")
        self.assertEqual(group.participant_count, 3)
        self.assertTrue(all(member.group_id == group.id for member in members))

    def test_pending_manager_is_rejected_without_writes(self):
        user, members, group, _goal = self.seed_target()
        user.pending_manager = True
        self.db.commit()

        with self.assertRaises(HTTPException) as raised:
            promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=OUTSIDE_MANAGER_WINDOW,
            )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("כבר מנהל או ממתין לקידום", raised.exception.detail)
        self.assertEqual(user.role, "user")
        self.assertEqual(members[0].role, "user")
        self.assertEqual(group.participant_count, 3)

    def test_non_admin_cannot_use_admin_endpoint_dependency(self):
        user, _members, _group, _goal = self.seed_target()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")

        with patch("app.api.admin.decode_access_token", return_value={"sub": str(user.id)}):
            with self.assertRaises(HTTPException) as raised:
                require_admin_without_auth_side_effects(credentials, self.db)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.detail, "Admin access required")

    def test_missing_group_is_a_clear_client_error(self):
        user, members, group, _goal = self.seed_target(with_group=False)

        with self.assertRaises(HTTPException) as raised:
            promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=OUTSIDE_MANAGER_WINDOW,
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("אינו משויך לקבוצה", raised.exception.detail)
        self.assertEqual(user.role, "user")
        self.assertIsNone(members[0].group_id)
        self.assertEqual(group.participant_count, 3)

    def test_regular_23_to_26_window_is_rejected_without_writes(self):
        user, members, group, _goal = self.seed_target()

        with self.assertRaises(HTTPException) as raised:
            promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=INSIDE_MANAGER_WINDOW,
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("23–26", raised.exception.detail)
        self.assertEqual(user.role, "user")
        self.assertEqual(members[0].role, "user")
        self.assertEqual(group.participant_count, 3)

    def test_zero_participant_count_warns_but_does_not_block(self):
        user, members, group, _goal = self.seed_target(participant_count=0)

        with self.assertLogs("app.api.admin", level="WARNING") as captured:
            promote_user_immediately(
                self.db,
                actor_admin_id=42,
                target_user_id=user.id,
                now=OUTSIDE_MANAGER_WINDOW,
            )
            self.db.commit()

        self.db.refresh(group)
        self.assertEqual(group.participant_count, 0)
        self.assertIn("participant_count_not_decremented", "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
