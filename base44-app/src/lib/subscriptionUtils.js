import {
  calendarDay,
  canAssignToGroup,
  isManagerTargetSelectionWindow,
  isSubscriptionStartPending,
} from "@/lib/calendarRules";

export function isAdmin(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

/**
 * Live manager, or a nominated manager whose promotion is already due.
 * JWT never embeds role — callers must use /me; this also covers a missed DB flip
 * so gates never bounce due managers to /pending.
 */
export function isManager(user, date = new Date()) {
  const role = String(user?.role || "").toLowerCase();
  if (role === "manager") return true;
  if (role === "admin" || !user?.pending_manager) return false;
  if (user.manager_effective_on) {
    const effective = new Date(user.manager_effective_on);
    if (Number.isNaN(effective.getTime())) return isManagerTargetSelectionWindow(date);
    return effective.getTime() <= date.getTime();
  }
  // Missing schedule: unlock only during the 23–24 promotion window.
  return isManagerTargetSelectionWindow(date);
}

/**
 * Today is inside the paid window.
 * Legacy PROD rows may have only subscription_end_date (no start) — treat as active
 * while status=active and end is still in the future.
 */
export function isUserActiveToday(user, date = new Date()) {
  if ((user?.subscription_status || "").toLowerCase() !== "active") return false;
  if (!user?.subscription_end_date) return false;
  const end = new Date(user.subscription_end_date);
  if (Number.isNaN(end.getTime()) || end < date) return false;
  if (!user.subscription_start_date) return true;
  const start = new Date(user.subscription_start_date);
  if (Number.isNaN(start.getTime())) return true;
  return start <= date;
}

/**
 * Skip onboarding / target re-selection.
 * Admin: always. Manager/user: only via group_id or active date range — never by role alone.
 */
export function shouldBypassOnboarding(user, member = null, date = new Date()) {
  if (isAdmin(user)) return true;
  if (isManager(user, date)) return true;
  const hasGroup = Boolean(user?.group_id || member?.group_id);
  return hasGroup || isUserActiveToday(user, date);
}

/**
 * Hard lock to /pending:
 * - Admin: never.
 * - Manager (live or due promotion): never (day 23–24 target gate lives in ManagerLayout).
 * - User: deferred subscription start, or unassigned outside the 25–26 window.
 */
export function isPendingAccessLocked(user, member = null, date = new Date()) {
  if (!user || isAdmin(user)) return false;
  if (isManager(user, date)) return false;

  const hasGroup = Boolean(user.group_id || member?.group_id);
  // Enrolled users mid-cycle keep access on days 1–24.
  if (user.role === "user" && hasGroup) return false;

  if (isSubscriptionStartPending(user, date)) return true;

  // Unassigned users stay frozen until assignment opens (25–26).
  if (user.role === "user" && !hasGroup && !canAssignToGroup(user, date)) {
    return true;
  }

  // Extra calendar freeze: before the 25th, unassigned / waiting users stay locked.
  if (user.role === "user" && !hasGroup && calendarDay(date) < 25) {
    return true;
  }

  return false;
}
