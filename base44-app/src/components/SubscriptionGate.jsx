import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { needsOnboardingWizard, needsPayment } from "@/lib/postAuth";
import { canAssignToGroup, isSubscriptionStartPending } from "@/lib/calendarRules";
import {
  isAdmin,
  isManager as userIsManager,
  isPendingAccessLocked,
  shouldBypassOnboarding,
} from "@/lib/subscriptionUtils";

export default function SubscriptionGate() {
  const location = useLocation();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const [member, setMember] = useState(null);
  const [hasWheel, setHasWheel] = useState(true);
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    if (isLoadingAuth || !user) {
      setLoadingExtras(false);
      return;
    }

    // Admin / enrolled-or-active via User fields: no extra fetches.
    // Member.group_id heal is handled after fetch / backend sync on /me.
    if (user.role !== "user" || shouldBypassOnboarding(user)) {
      setMember(null);
      setHasWheel(true);
      setLoadingExtras(false);
      return;
    }

    let cancelled = false;
    setLoadingExtras(true);
    (async () => {
      try {
        const rows = await apiClient.entities.Member.filter({ user_id: user.id });
        const m = rows[0] || null;
        if (cancelled) return;
        setMember(m);

        if (!user.onboarding_completed) {
          setHasWheel(true);
          return;
        }

        let goal = null;
        if (m?.goal_id) {
          try {
            goal = await apiClient.entities.Goal.get(m.goal_id);
          } catch {
            goal = null;
          }
        }
        if (!goal) {
          const owned = await apiClient.entities.Goal.filter({ owner_user_id: user.id });
          goal = owned[0] || null;
        }
        if (!goal) {
          if (!cancelled) setHasWheel(false);
          return;
        }
        const tasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
        if (!cancelled) setHasWheel(tasks.length > 0);
      } catch {
        if (!cancelled) {
          setMember(null);
          setHasWheel(true);
        }
      } finally {
        if (!cancelled) setLoadingExtras(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoadingAuth,
    user?.id,
    user?.role,
    user?.group_id,
    user?.onboarding_completed,
    user?.subscription_start_date,
    user?.subscription_end_date,
  ]);

  if (isLoadingAuth || (user && loadingExtras)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (isAdmin(user)) return <Outlet />;

  const isManager = userIsManager(user);
  const bypass = shouldBypassOnboarding(user, member);

  if (!isManager && needsPayment(user)) {
    return <Navigate to="/payment" replace />;
  }

  if (isPendingAccessLocked(user, member)) {
    if (user.role === "user" && !user.onboarding_completed && location.pathname.startsWith("/onboarding")) {
      return <Outlet />;
    }
    return <Navigate to="/pending" replace />;
  }

  if (!isManager && !bypass && needsOnboardingWizard(user, member)) {
    return <Navigate to="/onboarding" replace />;
  }

  // Wait-window finish may create a goal with zero tasks — do not bounce to /onboarding.
  const pendingEnrollment =
    isSubscriptionStartPending(user) || (!canAssignToGroup(user) && !member?.group_id);
  if (!isManager && !bypass && user.onboarding_completed && !hasWheel && !pendingEnrollment) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
