import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { isSubscriptionActive, isSubscriptionStartPending } from "@/lib/calendarRules";

/**
 * Hermetic lock for deferred payers: only /onboarding (if incomplete) and /pending are allowed.
 * Never lock users who are already active in the current period.
 */
export default function PendingEnrollmentGate() {
  const location = useLocation();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await apiClient.auth.me();
        if (!cancelled) setUser(u);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isPendingAccessLocked =
    user.role === "user" &&
    !isSubscriptionActive(user) &&
    isSubscriptionStartPending(user) &&
    !user.group_id;

  if (isPendingAccessLocked) {
    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (!user.onboarding_completed && onOnboarding) {
      return <Outlet />;
    }
    if (location.pathname.startsWith("/pending")) {
      return <Outlet />;
    }
    return <Navigate to={user.onboarding_completed ? "/pending" : "/onboarding"} replace />;
  }

  return <Outlet />;
}
