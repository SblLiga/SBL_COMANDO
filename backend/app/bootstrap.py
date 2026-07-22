import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Goal, Group, Member, SystemSetting, User
from app.security import hash_password

logger = logging.getLogger(__name__)


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
            password_hash=hash_password(settings.dev_admin_password),
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


def run_database_bootstrap(session: Session, settings: Settings) -> dict[str, bool]:
    if is_production(settings):
        created_admin = ensure_production_admin(session, settings)
        return {"seeded": False, "admin_created": created_admin}

    seeded = False
    if should_seed_dev_data(settings):
        seeded = seed_development_data(session, settings)

    return {"seeded": seeded, "admin_created": False}
