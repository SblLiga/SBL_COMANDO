import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    EmailVerificationToken,
    Goal,
    Group,
    MediaAsset,
    Meeting,
    Member,
    Notification,
    PasswordResetToken,
    Report,
    SystemSetting,
    Task,
    User,
)
from app.security import hash_password
from app.subscription import (
    activate_subscription,
    end_of_cycle_paid_through_after,
    end_of_immediate_paid_through_after,
    next_assignment_open_at,
)

logger = logging.getLogger(__name__)

# Canonical DEV accounts — created/repaired on every non-prod startup.
# seed_subscription:
#   active  → start/end cover "today" (usable dashboard)
#   pending → start = next 25th, no group (hard-lock /pending)
#   none    → admin: status active, no date gate
DEV_SEED_ACCOUNTS = (
    {
        "email": "admin.dev@sbl.local",
        "password_attr": "dev_admin_password",
        "password_fallback": "Admin123!",
        "full_name": "אדמין דמו",
        "role": "admin",
        "seed_subscription": "none",
    },
    {
        "email": "manager.dev@sbl.local",
        "password": "Manager123!",
        "full_name": "מנהלת דמו א׳",
        "role": "manager",
        "target": "מכירות",
        "gender": "female",
        "focus_target": "שיפור מכירות",
        "focus_month": "2026-07",
        "group": "alpha",
        "seed_subscription": "active",
    },
    {
        "email": "manager2.dev@sbl.local",
        "password": "Manager123!",
        "full_name": "מנהל דמו ב׳",
        "role": "manager",
        "target": "גיוס",
        "gender": "male",
        "focus_target": "גיוס לקוחות",
        "focus_month": "2026-07",
        "group": "beta",
        "seed_subscription": "active",
    },
    {
        "email": "user.dev@sbl.local",
        "password": "User123!",
        "full_name": "משתמשת דמו א׳",
        "role": "user",
        "target": "שיווק",
        "gender": "female",
        "group": "alpha",
        "seed_subscription": "active",
    },
    {
        "email": "user2.dev@sbl.local",
        "password": "User123!",
        "full_name": "משתמש דמו ב׳",
        "role": "user",
        "target": "מכירות",
        "gender": "male",
        "group": "alpha",
        "seed_subscription": "active",
    },
    {
        "email": "user3.dev@sbl.local",
        "password": "User123!",
        "full_name": "משתמשת דמו ג׳",
        "role": "user",
        "target": "גיוס",
        "gender": "female",
        "group": "beta",
        "seed_subscription": "active",
    },
    {
        "email": "user4.dev@sbl.local",
        "password": "User123!",
        "full_name": "משתמש דמו ד׳ (בהמתנה)",
        "role": "user",
        "target": "שיווק",
        "gender": "male",
        "group": None,
        "seed_subscription": "pending",
    },
)

# Temporary PROD QA accounts for client UAT — cleaned on handoff.
PROD_QA_SEED_ACCOUNTS = (
    {
        "email": "qa.admin@sblliga.com",
        "password": "SblQa2026!Admin",
        "full_name": "אדמין בדיקות",
        "role": "admin",
    },
    {
        "email": "qa.manager@sblliga.com",
        "password": "SblQa2026!Manager",
        "full_name": "מנהלת בדיקות",
        "role": "manager",
        "target": "מכירות",
        "gender": "female",
        "focus_target": "שיפור מכירות",
        "focus_month": "2026-07",
        "group": "qa",
    },
    {
        "email": "qa.user@sblliga.com",
        "password": "SblQa2026!User",
        "full_name": "משתמשת בדיקות",
        "role": "user",
        "target": "שיווק",
        "gender": "female",
        "group": "qa",
    },
    {
        "email": "qa.user2@sblliga.com",
        "password": "SblQa2026!User",
        "full_name": "משתמש בדיקות ב׳",
        "role": "user",
        "target": "מכירות",
        "gender": "male",
        "group": "qa",
    },
)

# Internal test registrations to wipe before client handoff (never recreate).
PROD_HANDOFF_JUNK_EMAILS = frozenset(
    {
        "esthergenauer@gmail.com",
        "gen@gmail.com",
        "esti@gmail.com",
        "hg0527157320@gmail.com",
        "dmalky100@gmail.com",
        "e@gmail.com",
        "genauer1997@gmail.com",
    }
)

# Client handoff emails (create-only). Passwords MUST come from env / Secrets Manager —
# never store plaintext credentials in git.
CLIENT_HANDOFF_ACCOUNTS = (
    {
        "email": "sbl.school1@gmail.com",
        "password_env": "HANDOFF_PASSWORD_MICHAL",
        "full_name": "מיכל מזכירה",
        "role": "admin",
    },
    {
        "email": "shuliyazdi2000@gmail.com",
        "password_env": "HANDOFF_PASSWORD_SHULI",
        "full_name": "שולי בן לולו",
        "role": "admin",
    },
    {
        "email": "e6666668@gmail.com",
        "password_env": "HANDOFF_PASSWORD_ESTI",
        "full_name": "אסתי לוי",
        "role": "user",
    },
    {
        "email": "nech0329@gmail.com",
        "password_env": "HANDOFF_PASSWORD_NEHAMA",
        "full_name": "נחמה גלינסקי",
        "role": "user",
    },
    {
        "email": "yaaras9@gmail.com",
        "password_env": "HANDOFF_PASSWORD_ITAY",
        "full_name": "איתי פתיה",
        "role": "user",
    },
    {
        "email": "tehilakadosh10@gmail.com",
        "password_env": "HANDOFF_PASSWORD_TEHILA",
        "full_name": "תהילה קדוש",
        "role": "user",
    },
)

_DEMO_TASKS = (
    "שיחת מכירה יומית",
    "מעקב לידים",
    "פוסט ברשתות",
    "סיכום שבועי",
    "תרגול מיומנות",
)


def is_production(settings: Settings) -> bool:
    return settings.app_env.lower() in {"prod", "production"}


def should_seed_dev_data(settings: Settings) -> bool:
    if is_production(settings):
        return False
    if settings.seed_dev_data is not None:
        return settings.seed_dev_data
    return True


def _admin_exists(session: Session) -> bool:
    return (
        session.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0
    ) > 0


def _any_users_exist(session: Session) -> bool:
    return (session.scalar(select(func.count()).select_from(User)) or 0) > 0


def _dev_account_password(account: dict, settings: Settings) -> str:
    if "password_attr" in account:
        return getattr(settings, account["password_attr"], None) or account["password_fallback"]
    return account["password"]


def _apply_seed_subscription(user: User, mode: str) -> None:
    """Force demo subscription windows independent of today's wait-window calendar."""
    try:
        from zoneinfo import ZoneInfo

        israel = ZoneInfo("Asia/Jerusalem")
    except Exception:
        israel = timezone(timedelta(hours=3))

    user.subscription_status = "active"
    if mode == "pending":
        start = next_assignment_open_at()
        user.subscription_start_date = start
        user.subscription_end_date = end_of_cycle_paid_through_after(start)
        user.group_id = None
        return
    if mode == "active":
        local = datetime.now(israel)
        start_local = datetime(local.year, local.month, 1, 0, 0, 0, tzinfo=israel)
        start = start_local.astimezone(timezone.utc)
        user.subscription_start_date = start
        user.subscription_end_date = end_of_immediate_paid_through_after(start)
        return
    # admin / none — status only
    user.subscription_start_date = None
    user.subscription_end_date = None


def _ensure_demo_group(
    session: Session,
    *,
    name: str,
    description: str,
    target: str,
    gender: str,
    manager_name: str,
) -> Group:
    group = session.scalar(select(Group).where(Group.name == name))
    if group is None:
        group = Group(
            name=name,
            description=description,
            target=target,
            gender=gender,
            manager_name=manager_name,
            participant_count=0,
            max_participants=8,
            status="on_track",
            avg_progress=25.0,
        )
        session.add(group)
        session.flush()
    return group


def _ensure_goal_with_tasks(
    session: Session,
    user: User,
    *,
    title: str,
    target: str,
    reward: str,
    progress: float,
    xp: float,
    streak: int,
) -> Goal:
    goal = session.scalar(select(Goal).where(Goal.owner_user_id == user.id))
    if goal is None:
        goal = Goal(
            title=title,
            target=target,
            reward_text=reward,
            cycle_month="2026-07",
            progress=progress,
            xp_total=xp,
            streak=streak,
            owner_user_id=user.id,
        )
        session.add(goal)
        session.flush()
    task_count = (
        session.scalar(select(func.count()).select_from(Task).where(Task.goal_id == goal.id)) or 0
    )
    if task_count == 0:
        for idx, task_title in enumerate(_DEMO_TASKS):
            session.add(
                Task(
                    goal_id=goal.id,
                    title=task_title,
                    order_index=idx,
                    is_completed=idx == 0,
                    priority="בינוני" if idx % 2 == 0 else "דחוף",
                    xp_value=100.0,
                )
            )
        session.flush()
    return goal


def _upsert_member(
    session: Session,
    user: User,
    *,
    group: Group | None,
    goal: Goal | None,
    role: str,
) -> None:
    member = session.scalar(select(Member).where(Member.user_id == user.id))
    payload = {
        "name": user.full_name,
        "user_id": user.id,
        "group_id": group.id if group else None,
        "group_name": group.name if group else None,
        "role": role,
        "target": user.target,
        "gender": user.gender,
        "goal_id": goal.id if goal else None,
        "goal_title": goal.title if goal else None,
        "progress": goal.progress if goal else 0.0,
        "xp": goal.xp_total if goal else 0.0,
        "streak": goal.streak if goal else 0,
        "status": "בעקבות",
    }
    if member is None:
        if role == "manager":
            payload["next_month_target"] = user.target or "מכירות"
            payload["next_month_selected_at"] = datetime.now(timezone.utc)
        session.add(Member(**payload))
    else:
        for key, value in payload.items():
            setattr(member, key, value)
        if role == "manager" and not member.next_month_selected_at:
            member.next_month_target = member.target or user.target or "מכירות"
            member.next_month_selected_at = datetime.now(timezone.utc)


def _upsert_seed_accounts(
    session: Session,
    settings: Settings,
    accounts: tuple[dict, ...],
    *,
    groups: dict[str, Group],
    manager_links: tuple[tuple[str, str], ...],
    log_label: str,
) -> int:
    """Idempotent CREATE + repair for demo/QA users, groups, goals and tasks."""
    changed = 0

    if session.scalar(select(func.count()).select_from(SystemSetting)) == 0:
        session.add(SystemSetting())
        changed += 1

    for account in accounts:
        email = account["email"]
        password = _dev_account_password(account, settings)
        seed_sub = account.get("seed_subscription") or (
            "pending" if account.get("group") is None and account["role"] == "user" else "active"
        )
        if account["role"] == "admin":
            seed_sub = "none"

        user = session.scalar(select(User).where(User.email == email))
        created = False
        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(password),
                full_name=account["full_name"],
                role=account["role"],
                subscription_status="active",
                onboarding_completed=True,
                onboarding_completed_at=datetime.now(timezone.utc),
                email_verified=True,
                is_active=True,
                target=account.get("target"),
                gender=account.get("gender"),
                focus_target=account.get("focus_target"),
                focus_month=account.get("focus_month"),
            )
            session.add(user)
            session.flush()
            created = True
            changed += 1
        else:
            user.email_verified = True
            user.is_active = True
            user.password_hash = hash_password(password)
            user.role = account["role"]
            user.full_name = account.get("full_name") or user.full_name
            user.onboarding_completed = True
            if not user.onboarding_completed_at:
                user.onboarding_completed_at = datetime.now(timezone.utc)
            if "target" in account:
                user.target = account["target"]
            if "gender" in account:
                user.gender = account["gender"]
            if "focus_target" in account:
                user.focus_target = account["focus_target"]
            if "focus_month" in account:
                user.focus_month = account["focus_month"]
            changed += 1

        _apply_seed_subscription(user, seed_sub)

        group_key = account.get("group")
        group = groups.get(group_key) if group_key else None
        if seed_sub == "pending" or group is None:
            user.group_id = None
            group = None
        elif group is not None:
            user.group_id = group.id

        if account["role"] == "admin":
            for row in session.scalars(select(Member).where(Member.user_id == user.id)).all():
                session.delete(row)
                changed += 1
            continue

        goal = None
        if account["role"] in {"manager", "user"}:
            goal = _ensure_goal_with_tasks(
                session,
                user,
                title=f"יעד חודשי - {account.get('target') or 'כללי'}",
                target=account.get("target") or "מכירות",
                reward="פרס דמו",
                progress=35.0 if account["role"] == "manager" else 20.0,
                xp=120.0 if account["role"] == "manager" else 80.0,
                streak=4 if account["role"] == "manager" else 2,
            )
            _upsert_member(
                session,
                user,
                group=group,
                goal=goal,
                role=account["role"],
            )
            changed += 1

        if created:
            logger.info("%s seed created account %s (%s)", log_label, email, account["role"])

    for email, group_key in manager_links:
        group = groups.get(group_key)
        if group is None:
            continue
        manager = session.scalar(select(User).where(User.email == email))
        if manager:
            group.manager_id = manager.id
            group.manager_name = manager.full_name
            manager.group_id = group.id

    for group in groups.values():
        count = (
            session.scalar(
                select(func.count())
                .select_from(Member)
                .where(Member.group_id == group.id, Member.role == "user")
            )
            or 0
        )
        group.participant_count = count

    session.commit()
    logger.info("%s seed accounts upserted/repaired (delta_marker=%s)", log_label, changed)
    return changed


def ensure_dev_seed_accounts(session: Session, settings: Settings) -> int:
    """
    Idempotent CREATE + repair for DEV demo users, groups, goals and tasks.

    Works even when the DB already has real registered users — missing seed
    accounts are inserted; existing ones get passwords/roles reset.
    """
    alpha = _ensure_demo_group(
        session,
        name="Dev Alpha Team",
        description="קבוצת דמו לבדיקות DEV",
        target="מכירות",
        gender="female",
        manager_name="מנהלת דמו א׳",
    )
    beta = _ensure_demo_group(
        session,
        name="Dev Beta Team",
        description="קבוצת דמו שנייה לבדיקות DEV",
        target="גיוס",
        gender="male",
        manager_name="מנהל דמו ב׳",
    )
    groups = {"alpha": alpha, "beta": beta}
    return _upsert_seed_accounts(
        session,
        settings,
        DEV_SEED_ACCOUNTS,
        groups=groups,
        manager_links=(
            ("manager.dev@sbl.local", "alpha"),
            ("manager2.dev@sbl.local", "beta"),
        ),
        log_label="DEV",
    )


def ensure_prod_qa_accounts(session: Session, settings: Settings) -> int:
    """Deprecated: temporary UAT seeding must not run on client handoff PROD."""
    logger.info("PROD QA seed skipped (disabled for client handoff)")
    return 0


def cleanup_prod_qa_accounts(session: Session) -> int:
    """Remove temporary QA/test users + demo group before client handoff."""
    from sqlalchemy import or_

    qa_emails = {account["email"].lower() for account in PROD_QA_SEED_ACCOUNTS}
    junk_emails = set(PROD_HANDOFF_JUNK_EMAILS) | qa_emails
    qa_group_name = "קבוצת בדיקות QA"
    removed = 0

    users = session.scalars(select(User).where(User.email.in_(junk_emails))).all()
    user_ids = [user.id for user in users]

    if user_ids:
        goals = session.scalars(select(Goal).where(Goal.owner_user_id.in_(user_ids))).all()
        goal_ids = [goal.id for goal in goals]
        if goal_ids:
            for task in session.scalars(select(Task).where(Task.goal_id.in_(goal_ids))).all():
                session.delete(task)
                removed += 1
        for goal in goals:
            session.delete(goal)
            removed += 1

        for member in session.scalars(select(Member).where(Member.user_id.in_(user_ids))).all():
            session.delete(member)
            removed += 1

        for token in session.scalars(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id.in_(user_ids))
        ).all():
            session.delete(token)
            removed += 1

        for token in session.scalars(
            select(PasswordResetToken).where(PasswordResetToken.user_id.in_(user_ids))
        ).all():
            session.delete(token)
            removed += 1

        for note in session.scalars(
            select(Notification).where(
                or_(
                    Notification.target_user_id.in_(user_ids),
                    Notification.source_user_id.in_(user_ids),
                )
            )
        ).all():
            session.delete(note)
            removed += 1

        for asset in session.scalars(
            select(MediaAsset).where(MediaAsset.owner_user_id.in_(user_ids))
        ).all():
            session.delete(asset)
            removed += 1

        for group in session.scalars(select(Group).where(Group.manager_id.in_(user_ids))).all():
            group.manager_id = None

        for user in users:
            user.group_id = None
            session.delete(user)
            removed += 1

    qa_group = session.scalar(select(Group).where(Group.name == qa_group_name))
    if qa_group is not None:
        for member in session.scalars(
            select(Member).where(
                or_(Member.group_id == qa_group.id, Member.group_name == qa_group_name)
            )
        ).all():
            session.delete(member)
            removed += 1
        for meeting in session.scalars(
            select(Meeting).where(
                or_(Meeting.group_id == qa_group.id, Meeting.group_name == qa_group_name)
            )
        ).all():
            session.delete(meeting)
            removed += 1
        for report in session.scalars(select(Report).where(Report.group_id == qa_group.id)).all():
            session.delete(report)
            removed += 1
        session.delete(qa_group)
        removed += 1

    if removed:
        session.commit()
        logger.info("PROD handoff cleanup removed %s rows", removed)
    else:
        logger.info("PROD handoff cleanup: nothing to remove")
    return removed


def ensure_production_admin(session: Session, settings: Settings) -> bool:
    """Create or repair the permanent client admin from Secrets Manager."""
    if not settings.admin_email or not settings.admin_password:
        logger.warning(
            "Production bootstrap skipped: ADMIN_EMAIL and ADMIN_PASSWORD must be set"
        )
        return False

    email = settings.admin_email.strip().lower()
    password = settings.admin_password
    admin = session.scalar(select(User).where(User.email == email))
    created = False

    if admin is None:
        admin = User(
            email=email,
            password_hash=hash_password(password),
            full_name="אדמין שולי בן לולו",
            role="admin",
            subscription_status="active",
            onboarding_completed=True,
            email_verified=True,
            is_active=True,
        )
        session.add(admin)
        activate_subscription(admin)
        created = True
    else:
        # Create-only for password: never overwrite a password the admin changed in-app.
        admin.role = "admin"
        admin.onboarding_completed = True
        admin.email_verified = True
        admin.is_active = True
        if not admin.full_name:
            admin.full_name = "אדמין שולי בן לולו"

    session.commit()
    logger.info(
        "Production admin %s for %s",
        "created" if created else "repaired",
        email,
    )
    return True


def ensure_client_handoff_accounts(session: Session) -> int:
    """
    Create missing handoff accounts once.
    Never overwrite password_hash or renew subscription for existing users
    (avoids wiping Profile password changes on every deploy).
    """
    changed = 0
    for account in CLIENT_HANDOFF_ACCOUNTS:
        email = account["email"].strip().lower()
        user = session.scalar(select(User).where(User.email == email))
        is_admin = account["role"] == "admin"
        if user is None:
            password = (os.environ.get(account.get("password_env") or "") or "").strip()
            if not password:
                logger.warning(
                    "Handoff account %s missing — set %s to create (create-only)",
                    email,
                    account.get("password_env"),
                )
                continue
            user = User(
                email=email,
                password_hash=hash_password(password),
                full_name=account["full_name"],
                role=account["role"],
                subscription_status="active",
                onboarding_completed=is_admin,
                email_verified=True,
                is_active=True,
            )
            session.add(user)
            session.flush()
            activate_subscription(user)
            changed += 1
            logger.info(
                "Handoff account created %s (%s)",
                email,
                account["role"],
            )
        else:
            # Soft repair only — never reset password, extend subscription, or force-activate.
            touched = False
            if account["full_name"] and user.full_name != account["full_name"]:
                user.full_name = account["full_name"]
                touched = True
            if user.role != account["role"] and is_admin:
                user.role = account["role"]
                touched = True
            if not user.email_verified:
                user.email_verified = True
                touched = True
            if is_admin and not user.onboarding_completed:
                user.onboarding_completed = True
                touched = True
            if touched:
                changed += 1
                logger.info("Handoff account soft-repaired %s (%s)", email, account["role"])
        session.commit()
    logger.info("Client handoff accounts upserted (delta_marker=%s)", changed)
    return changed


def seed_development_data(session: Session, settings: Settings) -> bool:
    """
    Legacy empty-DB path. Prefer ensure_dev_seed_accounts which also creates
    accounts when the DB already has other users.
    """
    if _any_users_exist(session):
        logger.info("Development seed skipped: users already exist (upsert handles demos)")
        return False
    # Empty DB — upsert creates everything
    ensure_dev_seed_accounts(session, settings)
    logger.info("Development seed data created via upsert")
    return True


def ensure_manager_operational_alerts(session: Session) -> int:
    """
    Create missing operational alerts for managers:
    - inactive participants (explicit status לא פעיל / קריטי only)
    - missing weekly report 3+ days after completed meeting
    Idempotent via title+target_user_id uniqueness check.
    """
    created = 0
    now = datetime.now(timezone.utc)
    managers = session.scalars(select(Member).where(Member.role == "manager")).all()

    for mgr in managers:
        if not mgr.user_id:
            continue
        if mgr.group_id:
            peers = session.scalars(
                select(Member).where(Member.role == "user", Member.group_id == mgr.group_id)
            ).all()
        else:
            peers = session.scalars(
                select(Member).where(Member.role == "user", Member.group_name == mgr.group_name)
            ).all()

        for peer in peers:
            stamp = peer.created_at
            age_days = 0
            if stamp:
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                age_days = max(0, (now - stamp).days)
            inactive = peer.status in ("לא פעיל", "קריטי")
            if not inactive:
                continue
            days = max(age_days, 1) if age_days else 1
            title = f"{peer.name} - לא פעיל"
            exists = session.scalar(
                select(Notification).where(
                    Notification.target_user_id == mgr.user_id,
                    Notification.title == title,
                    Notification.is_handled.is_(False),
                )
            )
            if exists:
                continue
            session.add(
                Notification(
                    target_user_id=mgr.user_id,
                    title=title,
                    body=f"{days} ימים ללא פעילות",
                    type="warning",
                    source="המערכת",
                    is_read=False,
                    is_handled=False,
                )
            )
            created += 1

        meetings = session.scalars(
            select(Meeting).where(
                Meeting.group_name == mgr.group_name,
                Meeting.status == "completed",
                Meeting.is_locked.is_(False),
            )
        ).all()
        for meeting in meetings:
            when = meeting.scheduled_date or meeting.created_at
            if not when:
                continue
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            if now - when < timedelta(days=3):
                continue
            title = "דוח חסר"
            body = f"לא שלחת דוח לאדמין לאחר הפגישה · {when.strftime('%d/%m')}"
            exists = session.scalar(
                select(Notification).where(
                    Notification.target_user_id == mgr.user_id,
                    Notification.title == title,
                    Notification.body == body,
                    Notification.is_handled.is_(False),
                )
            )
            if exists:
                continue
            session.add(
                Notification(
                    target_user_id=mgr.user_id,
                    title=title,
                    body=body,
                    type="info",
                    source="המערכת",
                    is_read=False,
                    is_handled=False,
                )
            )
            created += 1

    if created:
        session.commit()
        logger.info("Operational manager alerts created: %s", created)
    return created


def run_database_bootstrap(session: Session, settings: Settings) -> dict[str, bool | int]:
    if is_production(settings):
        created_admin = ensure_production_admin(session, settings)
        handoff = ensure_client_handoff_accounts(session)
        qa_cleaned = cleanup_prod_qa_accounts(session)
        alerts = ensure_manager_operational_alerts(session)
        return {
            "seeded": False,
            "admin_created": created_admin,
            "client_handoff": handoff,
            "prod_qa_cleaned": qa_cleaned,
            "dev_repaired": 0,
            "alerts_created": alerts,
        }

    seeded = False
    repaired = 0
    if should_seed_dev_data(settings):
        # Upsert demos even when other users already exist
        repaired = ensure_dev_seed_accounts(session, settings)
        seeded = repaired > 0
    handoff = ensure_client_handoff_accounts(session)
    alerts = ensure_manager_operational_alerts(session)

    return {
        "seeded": seeded,
        "admin_created": False,
        "client_handoff": handoff,
        "dev_repaired": repaired,
        "alerts_created": alerts,
    }
