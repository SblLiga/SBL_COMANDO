import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, isManager, isPendingAccessLocked } from "@/lib/subscriptionUtils";

export default function PendingEnrollmentGate() {
  const location = useLocation();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  // Admin: never blocked. Manager: never blocked (day-23 target gate lives in ManagerLayout).
  if (isAdmin(user) || isManager(user)) return <Outlet />;

  if (isPendingAccessLocked(user)) {
    if (location.pathname.startsWith("/pending")) {
      return <Outlet />;
    }
    if (user.role === "user" && !user.onboarding_completed && location.pathname.startsWith("/onboarding")) {
      return <Outlet />;
    }
    if (user.role === "user" && !user.onboarding_completed) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/pending" replace />;
  }

  return <Outlet />;
}
