/**
 * Calendar rules from product specs (Israel calendar day).
 * - Managers: next-month target selection from day 23 until chosen.
 * - Users: registration from day 23; group assignment / monthly onboarding from day 25.
 * - From day 25 the active cycle is the *next* calendar month (new wheel + group).
 */

export function calendarDay(date = new Date()) {
  return date.getDate();
}

export function isManagerTargetSelectionWindow(date = new Date()) {
  return calendarDay(date) >= 23;
}

export function isUserRegistrationWindow(date = new Date()) {
  return calendarDay(date) >= 23;
}

export function isUserAssignmentWindow(date = new Date()) {
  return calendarDay(date) >= 25;
}

export function isMonthlyOnboardingResetDay(date = new Date()) {
  return calendarDay(date) === 25;
}

export function sameCalendarMonth(a, b = new Date()) {
  const d = a instanceof Date ? a : new Date(a);
  return d.getMonth() === b.getMonth() && d.getFullYear() === b.getFullYear();
}

/** Active league cycle label (YYYY-MM). From day 25 → next month. */
export function currentCycleMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  if (calendarDay(date) >= 25) {
    d.setMonth(d.getMonth() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

/** Waiting-list users must complete manager/group assignment once day ≥ 25. */
export function needsWaitingListAssignment(user, member, date = new Date()) {
  if (!user || user.role !== "user") return false;
  if (!isUserAssignmentWindow(date)) return false;
  if (!user.onboarding_completed) return false;
  return !member?.group_id;
}
