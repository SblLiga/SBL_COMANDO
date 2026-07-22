/**
 * Calendar rules from product specs (Israel calendar day).
 * - Managers: next-month target selection from day 23 until chosen.
 * - Users: registration from day 23; group assignment / monthly onboarding from day 25.
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

export function needsMonthlyOnboarding(user, date = new Date()) {
  if (!user) return true;
  if (!user.onboarding_completed) return true;
  // Monthly reset starts on the 25th; only if last completion was in a prior month
  if (!isUserAssignmentWindow(date)) return false;
  if (!user.onboarding_completed_at) return false;
  return !sameCalendarMonth(user.onboarding_completed_at, date);
}

/** Waiting-list users must complete manager/group assignment once day ≥ 25. */
export function needsWaitingListAssignment(user, member, date = new Date()) {
  if (!user || user.role !== "user") return false;
  if (!isUserAssignmentWindow(date)) return false;
  if (!user.onboarding_completed) return false;
  return !member?.group_id;
}
