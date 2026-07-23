import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Goal, Group, Meeting, Member, Notification, SystemSetting, User
from app.security import hash_password

logger = logging.getLogger(__name__)

# Canonical DEV accounts — repaired on every non-prod startup so login always works.
DEV_SEED_ACCOUNTS = (
    {
        "email": "admin.dev@sbl.local",
        "password_attr": "dev_admin_password",
        "password_fallback": "Admin123!",
        "full_name": "Dev Admin",
        "role": "admin",
    },
    {
        "email": "manager.dev@sbl.local",
        "password": "Manager123!",
        "full_name": "Dev Manager",
        "role": "manager",
        "target": "מכירות",
        "focus_target": "שיפור מכירות",
        "focus_month": "2026-07",
    },
    {
        "email": "user.dev@sbl.local",
        "password": "User123!",
        "full_name": "Dev User",
        "role": "user",
        "target": "שיווק",
        "gender": "female",
    },
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


def ensure_dev_seed_accounts(session: Session, settings: Settings) -> int:
    """
    Idempotent repair for DEV seed users + Member/Goal/Group demo graph.

    Existing DBs may predate email_verified / have False defaults. Every DEV
    startup marks the known seed accounts verified and resets their passwords
    to the documented credentials so Login always works. Also ensures manager
    and user have Member rows with correct roles for QA flows.
    """
    repaired = 0
    for account in DEV_SEED_ACCOUNTS:
        email = account["email"]
        user = session.scalar(select(User).where(User.email == email))
        if user is None:
            continue

        password = _dev_account_password(account, settings)
        user.email_verified = True
        user.is_active = True
        user.password_hash = hash_password(password)
        user.role = account["role"]
        user.full_name = account.get("full_name") or user.full_name
        user.subscription_status = "active"
        user.onboarding_completed = True
        if "target" in account:
            user.target = account["target"]
        if "gender" in account:
            user.gender = account["gender"]
        if "focus_target" in account:
            user.focus_target = account["focus_target"]
        if "focus_month" in account:
            user.focus_month = account["focus_month"]
        repaired += 1

    # Ensure demo group
    group = session.scalar(select(Group).where(Group.name == "Dev Alpha Team"))
    if group is None:
        group = Group(
            name="Dev Alpha Team",
            description="Sample development group for DEV testing",
            target="מכירות",
            gender="female",
            manager_name="Dev Manager",
            participant_count=2,
            max_participants=5,
            status="on_track",
            avg_progress=30.0,
        )
        session.add(group)
        session.flush()
        repaired += 1

    manager = session.scalar(select(User).where(User.email == "manager.dev@sbl.local"))
    participant = session.scalar(select(User).where(User.email == "user.dev@sbl.local"))

    if manager:
        manager.group_id = group.id
        group.manager_id = manager.id
        group.manager_name = manager.full_name
        mgr_goal = session.scalar(select(Goal).where(Goal.owner_user_id == manager.id))
        if mgr_goal is None:
            mgr_goal = Goal(
                title="יעד חודשי - מכירות",
                target="מכירות",
                reward_text="ארוחת צוות",
                cycle_month="2026-07",
                progress=35.0,
                xp_total=120.0,
                streak=4,
                owner_user_id=manager.id,
            )
            session.add(mgr_goal)
            session.flush()
            repaired += 1
        mgr_member = session.scalar(select(Member).where(Member.user_id == manager.id))
        if mgr_member is None:
            session.add(
                Member(
                    name=manager.full_name,
                    user_id=manager.id,
                    group_id=group.id,
                    group_name=group.name,
                    role="manager",
                    target=manager.target or "מכירות",
                    goal_id=mgr_goal.id,
                    goal_title=mgr_goal.title,
                    progress=mgr_goal.progress,
                    xp=mgr_goal.xp_total,
                    streak=mgr_goal.streak,
                    status="בעקבות",
                    next_month_target=manager.target or "מכירות",
                    next_month_selected_at=datetime.now(timezone.utc),
                )
            )
            repaired += 1
        else:
            mgr_member.role = "manager"
            mgr_member.group_id = group.id
            mgr_member.group_name = group.name
            mgr_member.goal_id = mgr_goal.id
            mgr_member.goal_title = mgr_goal.title
            mgr_member.name = manager.full_name
            # Avoid blocking the manager UI on demo days (≥23) with an empty next-month modal
            if not mgr_member.next_month_selected_at:
                mgr_member.next_month_target = mgr_member.target or manager.target or "מכירות"
                mgr_member.next_month_selected_at = datetime.now(timezone.utc)
                repaired += 1

    if participant:
        participant.group_id = group.id
        user_goal = session.scalar(select(Goal).where(Goal.owner_user_id == participant.id))
        if user_goal is None:
            user_goal = Goal(
                title="יעד חודשי - שיווק",
                target="שיווק",
                reward_text="יום חופש",
                cycle_month="2026-07",
                progress=20.0,
                xp_total=80.0,
                streak=2,
                owner_user_id=participant.id,
            )
            session.add(user_goal)
            session.flush()
            repaired += 1
        user_member = session.scalar(select(Member).where(Member.user_id == participant.id))
        if user_member is None:
            session.add(
                Member(
                    name=participant.full_name,
                    user_id=participant.id,
                    group_id=group.id,
                    group_name=group.name,
                    role="user",
                    target=participant.target or "שיווק",
                    gender=participant.gender or "female",
                    goal_id=user_goal.id,
                    goal_title=user_goal.title,
                    progress=user_goal.progress,
                    xp=user_goal.xp_total,
                    streak=user_goal.streak,
                    status="בעקבות",
                )
            )
            repaired += 1
        else:
            user_member.role = "user"
            user_member.group_id = group.id
            user_member.group_name = group.name
            user_member.goal_id = user_goal.id
            user_member.goal_title = user_goal.title
            user_member.name = participant.full_name
            user_member.gender = participant.gender or user_member.gender

    # Drop accidental admin Member rows (admin is not a league participant)
    admin = session.scalar(select(User).where(User.email == "admin.dev@sbl.local"))
    if admin:
        admin_members = session.scalars(select(Member).where(Member.user_id == admin.id)).all()
        for row in admin_members:
            session.delete(row)
            repaired += 1

    if repaired:
        session.commit()
        logger.info("DEV seed accounts repaired/verified: %s", repaired)
    return repaired


def ensure_production_admin(session: Session, settings: Settings) -> bool:
    if _admin_exists(session):
        logger.info("Production bootstrap skipped: admin user already exists")
        return False

    if not settings.admin_email or not settings.admin_password:
        logger.warning(
            "Production bootstrap skipped: ADMIN_EMAIL and ADMIN_PASSWORD must be set"
        )
        return False

    admin = User(
        email=settings.admin_email.strip().lower(),
        password_hash=hash_password(settings.admin_password),
        full_name="System Administrator",
        role="admin",
        subscription_status="active",
        onboarding_completed=True,
        email_verified=True,
        is_active=True,
    )
    session.add(admin)
    session.commit()
    logger.info("Production bootstrap created default admin user for %s", admin.email)
    return True


def seed_development_data(session: Session, settings: Settings) -> bool:
    if _any_users_exist(session):
        logger.info("Development seed skipped: users already exist")
        return False

    group = Group(
        name="Dev Alpha Team",
        description="Sample development group for local and DEV testing",
    )
    session.add(group)
    session.flush()

    users = [
        User(
            email="admin.dev@sbl.local",
            password_hash=hash_password(_dev_account_password(DEV_SEED_ACCOUNTS[0], settings)),
            full_name="Dev Admin",
            role="admin",
            subscription_status="active",
            onboarding_completed=True,
            email_verified=True,
            group_id=group.id,
        ),
        User(
            email="manager.dev@sbl.local",
            password_hash=hash_password("Manager123!"),
            full_name="Dev Manager",
            role="manager",
            subscription_status="active",
            target="מכירות",
            onboarding_completed=True,
            email_verified=True,
            group_id=group.id,
            focus_target="שיפור מכירות",
            focus_month="2026-07",
        ),
        User(
            email="user.dev@sbl.local",
            password_hash=hash_password("User123!"),
            full_name="Dev User",
            role="user",
            subscription_status="active",
            target="שיווק",
            gender="female",
            onboarding_completed=True,
            email_verified=True,
            group_id=group.id,
        ),
    ]
    session.add_all(users)
    session.flush()

    goals = [
        Goal(
            title="יעד חודשי - מכירות",
            target="מכירות",
            reward_text="ארוחת צוות",
            cycle_month="2026-07",
            progress=35.0,
            xp_total=120.0,
            streak=4,
            owner_user_id=users[1].id,
        ),
        Goal(
            title="יעד חודשי - שיווק",
            target="שיווק",
            reward_text="יום חופש",
            cycle_month="2026-07",
            progress=20.0,
            xp_total=80.0,
            streak=2,
            owner_user_id=users[2].id,
        ),
    ]
    session.add_all(goals)
    session.flush()

    members = [
        Member(
            name=users[1].full_name,
            user_id=users[1].id,
            group_id=group.id,
            group_name=group.name,
            role=users[1].role,
            target=users[1].target,
            goal_id=goals[0].id,
            goal_title=goals[0].title,
            progress=goals[0].progress,
            xp=goals[0].xp_total,
            streak=goals[0].streak,
        ),
        Member(
            name=users[2].full_name,
            user_id=users[2].id,
            group_id=group.id,
            group_name=group.name,
            role=users[2].role,
            target=users[2].target,
            gender=users[2].gender,
            goal_id=goals[1].id,
            goal_title=goals[1].title,
            progress=goals[1].progress,
            xp=goals[1].xp_total,
            streak=goals[1].streak,
        ),
    ]
    session.add_all(members)

    if session.scalar(select(func.count()).select_from(SystemSetting)) == 0:
        session.add(SystemSetting())

    session.commit()
    logger.info("Development seed data created (users=%s, goals=%s)", len(users), len(goals))
    return True


def ensure_manager_operational_alerts(session: Session) -> int:
    """
    Create missing operational alerts for managers:
    - inactive participants (status לא פעיל / קריטי, or stale created_at)
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
            # Prefer explicit inactive/critical status; fall back to stale rows (≥3 days)
            stamp = peer.created_at
            age_days = 0
            if stamp:
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                age_days = max(0, (now - stamp).days)
            inactive = peer.status in ("לא פעיל", "קריטי") or age_days >= 3
            if not inactive:
                continue
            days = max(age_days, 3) if age_days else 3
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
        return {"seeded": False, "admin_created": created_admin, "dev_repaired": 0}

    seeded = False
    repaired = 0
    alerts = 0
    if should_seed_dev_data(settings):
        seeded = seed_development_data(session, settings)
        repaired = ensure_dev_seed_accounts(session, settings)
        alerts = ensure_manager_operational_alerts(session)

    return {
        "seeded": seeded,
        "admin_created": False,
        "dev_repaired": repaired,
        "alerts_created": alerts,
    }
