import { canAssignToGroup, needsMonthlyOnboarding, needsWaitingListAssignment } from "@/lib/calendarRules";
import { homePathForRole } from "@/components/RoleRoute";
import { isAdmin, isPendingAccessLocked, shouldBypassOnboarding } from "@/lib/subscriptionUtils";

/**
 * "Registered" for product purposes = auth verified AND onboarding wizard finished
 * (target, tasks/wheel, reward). Incomplete users must always resume /onboarding —
 * except enrolled / currently-active users who go straight to the dashboard.
 * Admin always bypasses; managers are not forced through user onboarding.
 */
export function needsOnboardingWizard(user, member = null) {
  if (!user) return true;
  if (isAdmin(user) || user.role === "manager") return false;
  if (shouldBypassOnboarding(user, member)) return false;
  if (isPendingAccessLocked(user, member) && user.onboarding_completed) return false;
  if (!user.onboarding_completed) return true;
  if (needsMonthlyOnboarding(user)) return true;
  if (needsWaitingListAssignment(user, member)) return true;
  return false;
}

export function needsPayment(user) {
  if (!user) return false;
  if (isAdmin(user) || user.role === "manager") return false;
  return user.subscription_status === "inactive";
}

/** Where to send the user right after login / OTP. */
export function postAuthPath(user, member = null) {
  if (isAdmin(user)) return homePathForRole("admin");
  if (needsPayment(user)) return "/payment";
  if (isPendingAccessLocked(user, member)) {
    if (user?.role === "user" && !user.onboarding_completed) return "/onboarding";
    return "/pending";
  }
  // Waiting-list / unassigned users outside 25–26 stay on /pending (not dashboard).
  const hasGroup = Boolean(user?.group_id || member?.group_id);
  if (user?.role === "user" && !hasGroup && !canAssignToGroup(user)) {
    if (!user.onboarding_completed) return "/onboarding";
    return "/pending";
  }
  if (shouldBypassOnboarding(user, member)) return homePathForRole(user?.role);
  if (needsOnboardingWizard(user, member)) return "/onboarding";
  return homePathForRole(user?.role);
}
