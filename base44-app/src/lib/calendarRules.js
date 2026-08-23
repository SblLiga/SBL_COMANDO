/**
 * Calendar rules from product specs (Israel calendar day).
 * - Managers: next-month plan hard-gate on days 23–24 (inclusive).
 * - Users: registration from day 23; monthly onboarding from day 25.
 * - From day 25 the active cycle is the *next* calendar month (new wheel + group).
 * - Group assignment window: ONLY days 25–26, and only if subscription is active
 *   and not waiting on subscription_start_date (deferred payment in window 27→24).
 */

/** Inclusive manager promotion / plan-selection window (before users open on 25). */
export const MANAGER_WINDOW_START_DAY = 23;
export const MANAGER_WINDOW_END_DAY = 24;

export function calendarDay(date = new Date()) {
  return date.getDate();
}

/** Days 23–24: managers must set next-month target / zone / tasks / reward. */
export function isManagerTargetSelectionWindow(date = new Date()) {
  const d = calendarDay(date);
  return d >= MANAGER_WINDOW_START_DAY && d <= MANAGER_WINDOW_END_DAY;
}

export function isUserRegistrationWindow(date = new Date()) {
  return calendarDay(date) >= 23;
}

/** Monthly onboarding / cycle helpers still use day ≥ 25. */
export function isUserAssignmentWindow(date = new Date()) {
  return calendarDay(date) >= 25;
}

/** Strict group-assignment open days: 25 and 26 only. */
export function isGroupAssignmentOpenDay(date = new Date()) {
  const d = calendarDay(date);
  return d === 25 || d === 26;
}

/**
 * Paid user whose period has not started yet (paid in wait window 27→24).
 * Legacy users without subscription_start_date are never pending.
 */
export function isSubscriptionStartPending(user, date = new Date()) {
  if (!user || user.subscription_status !== "active") return false;
  if (!user.subscription_start_date) return false;
  const start = new Date(user.subscription_start_date);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() > date.getTime();
}

/**
 * True when the user may use the app now: status active and start date has arrived
 * (or legacy users with no start date). Deferred wait-window payers are not active yet.
 */
export function isSubscriptionActive(user, date = new Date()) {
  if (!user || String(user.subscription_status || "").toLowerCase() !== "active") {
    return false;
  }
  if (!user.subscription_start_date) return true;
  const start = new Date(user.subscription_start_date);
  if (Number.isNaN(start.getTime())) return true;
  return start.getTime() <= date.getTime();
}

/**
 * May actively pick a manager / join a group:
 * active subscription + not deferred-pending + calendar day is 25 or 26.
 */
export function canAssignToGroup(user, date = new Date()) {
  if (!user || user.subscription_status !== "active") return false;
  if (isSubscriptionStartPending(user, date)) return false;
  return isGroupAssignmentOpenDay(date);
}

export function isMonthlyOnboardingResetDay(date = new Date()) {
  return calendarDay(date) === 25;
}

/** Managers open / reset their personal cycle during the 23–24 window (users stay on 25). */
export function isManagerCycleRolloverDay(date = new Date()) {
  return isManagerTargetSelectionWindow(date);
}

export function sameCalendarMonth(a, b = new Date()) {
  const d = a instanceof Date ? a : new Date(a);
  return d.getMonth() === b.getMonth() && d.getFullYear() === b.getFullYear();
}

/**
 * Active league cycle label (YYYY-MM).
 * Users: day ≥ 25 → next month.
 * Managers: day ≥ 23 → next month (personal wheel only).
 * Admins: never auto-rolled by calendar (pass rolloverDay ≥ 32 to stamp plain month).
 */
export function currentCycleMonth(date = new Date(), rolloverDay = 25) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  if (calendarDay(date) >= rolloverDay) {
    d.setMonth(d.getMonth() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * On days 23–24 a manager must complete the next-month plan for this calendar month:
 * target, zone (gender), tasks (≥4), reward — stamped via next_month_selected_at.
 */
export function hasManagerNextMonthPlan(member) {
  if (!member?.next_month_target || !member?.next_month_zone || !member?.next_month_reward) {
    return false;
  }
  if (!member.next_month_selected_at) return false;
  const tasks = Array.isArray(member.next_month_tasks) ? member.next_month_tasks : [];
  return tasks.length >= 4;
}

export function needsManagerNextMonthTarget(member, date = new Date()) {
  if (!member || String(member.role || "").toLowerCase() !== "manager") return false;
  if (!isManagerTargetSelectionWindow(date)) return false;
  if (hasManagerNextMonthPlan(member) && sameCalendarMonth(member.next_month_selected_at, date)) {
    return false;
  }
  return true;
}

/**
 * True when the user must run the onboarding wizard again for a new monthly cycle.
 * From day ≥ 25: required unless they already completed onboarding on/after the 25th this month.
 */
export function needsMonthlyOnboarding(user, date = new Date()) {
  if (!user) return true;
  if (!user.onboarding_completed) return true;
  if (!isUserAssignmentWindow(date)) return false;
  if (!user.onboarding_completed_at) return true;
  const completed = new Date(user.onboarding_completed_at);
  const doneThisWindow =
    completed.getFullYear() === date.getFullYear() &&
    completed.getMonth() === date.getMonth() &&
    completed.getDate() >= 25;
  return !doneThisWindow;
}

/** Waiting-list users must pick a group only while assignment is actually open (25–26). */
export function needsWaitingListAssignment(user, member, date = new Date()) {
  if (!user || user.role !== "user") return false;
  if (!canAssignToGroup(user, date)) return false;
  if (!user.onboarding_completed) return false;
  return !member?.group_id;
}
