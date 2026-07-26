import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { needsOnboardingWizard, needsPayment } from "@/lib/postAuth";

export default function SubscriptionGate() {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [hasWheel, setHasWheel] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await apiClient.auth.me();
        setUser(u);
        if (u?.role === "user") {
          const rows = await apiClient.entities.Member.filter({ user_id: u.id });
          const m = rows[0] || null;
          setMember(m);
          // Defense: completed flag but no tasks/goal → force wizard again
          if (u.onboarding_completed) {
            let goal = null;
            if (m?.goal_id) {
              try {
                goal = await apiClient.entities.Goal.get(m.goal_id);
              } catch {
                goal = null;
              }
            }
            if (!goal) {
              const owned = await apiClient.entities.Goal.filter({ owner_user_id: u.id });
              goal = owned[0] || null;
            }
            if (!goal) {
              setHasWheel(false);
            } else {
              const tasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
              setHasWheel(tasks.length > 0);
            }
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isStaff = user.role === "manager" || user.role === "admin";

  if (!isStaff && needsPayment(user)) {
    return <Navigate to="/payment" replace />;
  }

  if (!isStaff && (needsOnboardingWizard(user, member) || !hasWheel)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
