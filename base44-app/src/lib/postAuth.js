import { needsMonthlyOnboarding, needsWaitingListAssignment, isSubscriptionStartPending } from "@/lib/calendarRules";
import { homePathForRole } from "@/components/RoleRoute";

/**
 * "Registered" for product purposes = auth verified AND onboarding wizard finished
 * (target, tasks/wheel, reward). Incomplete users must always resume /onboarding.
 */
export function needsOnboardingWizard(user, member = null) {
  if (!user) return true;
  if (user.role === "admin" || user.role === "manager") return false;
  // Hard lock: wait-window payers stay off the app until the 25th (except finishing onboarding).
  if (isSubscriptionStartPending(user) && user.onboarding_completed) return false;
  if (!user.onboarding_completed) return true;
  if (needsMonthlyOnboarding(user)) return true;
  if (needsWaitingListAssignment(user, member)) return true;
  return false;
}

export function needsPayment(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "manager") return false;
  return user.subscription_status === "inactive";
}

/** Where to send the user right after login / OTP. */
export function postAuthPath(user, member = null) {
  if (needsPayment(user)) return "/payment";
  if (user?.role === "user" && isSubscriptionStartPending(user)) {
    return user.onboarding_completed ? "/pending" : "/onboarding";
  }
  if (needsOnboardingWizard(user, member)) return "/onboarding";
  return homePathForRole(user?.role);
}
