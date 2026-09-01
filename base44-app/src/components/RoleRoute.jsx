import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, isManager } from "@/lib/subscriptionUtils";

export function homePathForRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "manager") return "/manager";
  return "/";
}

/** Prefer live flags (incl. due pending_manager) over a raw role string. */
export function homePathForUser(user) {
  if (isAdmin(user)) return "/admin";
  if (isManager(user)) return "/manager";
  return "/";
}

/**
 * Restrict nested routes to one or more roles.
 * Wrong role → redirect to that user's home interface.
 * Uses isManager so due promotions are not bounced to /pending or user home.
 */
export default function RoleRoute({ allow }) {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const allowed = (Array.isArray(allow) ? allow : [allow]).map((r) => String(r).toLowerCase());

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const matches = allowed.some((a) => {
    if (a === "admin") return isAdmin(user);
    if (a === "manager") return isManager(user);
    if (a === "user") return !isAdmin(user) && !isManager(user);
    return String(user?.role || "").toLowerCase() === a;
  });

  if (!matches) {
    return <Navigate to={homePathForUser(user)} replace />;
  }

  return <Outlet />;
}
