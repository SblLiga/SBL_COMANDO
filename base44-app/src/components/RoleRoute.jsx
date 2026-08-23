import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export function homePathForRole(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "manager") return "/manager";
  return "/";
}

/**
 * Restrict nested routes to one or more roles.
 * Wrong role → redirect to that user's home interface.
 * Role compare is case-insensitive so stale mixed-case tokens still route correctly.
 */
export default function RoleRoute({ allow }) {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const allowed = (Array.isArray(allow) ? allow : [allow]).map((r) => String(r).toLowerCase());
  const role = String(user?.role || "").toLowerCase();

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

  if (!allowed.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <Outlet />;
}
