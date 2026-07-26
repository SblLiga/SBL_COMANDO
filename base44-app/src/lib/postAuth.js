import { needsMonthlyOnboarding, needsWaitingListAssignment } from "@/lib/calendarRules";
import { homePathForRole } from "@/components/RoleRoute";

/**
 * "Registered" for product purposes = auth verified AND onboarding wizard finished
 * (target, tasks/wheel, reward). Incomplete users must always resume /onboarding.
 */
export function needsOnboardingWizard(user, member = null) {
  if (!user) return true;
  if (user.role === "admin" || user.role === "manager") return false;
  if (!user.onboarding_completed) return true;
  if (needsMonthlyOnboarding(user)) return true;
  if (needsWaitingListAssignment(user, member)) return true;
  return false;
}

/** Where to send the user right after login / OTP. */
export function postAuthPath(user, member = null) {
  if (needsOnboardingWizard(user, member)) return "/onboarding";
  return homePathForRole(user?.role);
}
