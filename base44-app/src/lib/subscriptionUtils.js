import { isSubscriptionStartPending } from "@/lib/calendarRules";

export function isAdmin(user) {
  return user?.role === "admin";
}

/** Today is inside subscription_start_date .. subscription_end_date (inclusive). */
export function isUserActiveToday(user, date = new Date()) {
  if (!user?.subscription_start_date || !user?.subscription_end_date) return false;
  const start = new Date(user.subscription_start_date);
  const end = new Date(user.subscription_end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= date && end >= date;
}

/**
 * Skip onboarding / target re-selection.
 * Admin: always. Manager/user: only via group_id or active date range — never by role alone.
 */
export function shouldBypassOnboarding(user, date = new Date()) {
  if (isAdmin(user)) return true;
  return Boolean(user?.group_id) || isUserActiveToday(user, date);
}

/**
 * Lock to /pending for manager + user when start is still in the future and they are not active today.
 * Admin is never locked. Regular users who already have a group stay unlocked.
 */
export function isPendingAccessLocked(user, date = new Date()) {
  if (!user || isAdmin(user)) return false;
  if (isUserActiveToday(user, date)) return false;
  if (!isSubscriptionStartPending(user, date)) return false;
  if (user.role === "user" && user.group_id) return false;
  return user.role === "user" || user.role === "manager";
}
