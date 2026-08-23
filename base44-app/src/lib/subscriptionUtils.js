import {
  calendarDay,
  canAssignToGroup,
  isSubscriptionStartPending,
} from "@/lib/calendarRules";

export function isAdmin(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

export function isManager(user) {
  return String(user?.role || "").toLowerCase() === "manager";
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
  const hasGroup = Boolean(user?.group_id || member?.group_id);
  return hasGroup || isUserActiveToday(user, date);
}

/**
 * Hard lock to /pending:
 * - Admin: never.
 * - Manager: never (must reach /manager from day 23 to pick next_month_target).
 * - User: deferred subscription start, or unassigned outside the 25–26 window.
 */
export function isPendingAccessLocked(user, member = null, date = new Date()) {
  if (!user || isAdmin(user)) return false;
  if (isManager(user)) return false;

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
