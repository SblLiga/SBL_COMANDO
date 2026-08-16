import { isSubscriptionStartPending } from "@/lib/calendarRules";

export function isAdmin(user) {
  return user?.role === "admin";
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
 * Lock to /pending for manager + user when start is still in the future and they are not active today.
 * Admin is never locked. Users who already have a group (User or Member) stay unlocked.
 */
export function isPendingAccessLocked(user, member = null, date = new Date()) {
  if (!user || isAdmin(user)) return false;
  if (isUserActiveToday(user, date)) return false;
  if (!isSubscriptionStartPending(user, date)) return false;
  if (user.role === "user" && (user.group_id || member?.group_id)) return false;
  return user.role === "user" || user.role === "manager";
}
