import { isSubscriptionStartPending } from "@/lib/calendarRules";

/** Today is inside subscription_start_date .. subscription_end_date (inclusive). */
export function isUserActiveToday(user, date = new Date()) {
  if (!user?.subscription_start_date || !user?.subscription_end_date) return false;
  const start = new Date(user.subscription_start_date);
  const end = new Date(user.subscription_end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= date && end >= date;
}

/** Lock to /pending: not active today, start still pending, and no group. */
export function isPendingAccessLocked(user, date = new Date()) {
  return (
    !isUserActiveToday(user, date) &&
    isSubscriptionStartPending(user, date) &&
    !user?.group_id
  );
}
