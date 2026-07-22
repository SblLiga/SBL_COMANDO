import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export function homePathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/";
}

/**
 * Restrict nested routes to one or more roles.
 * Wrong role → redirect to that user's home interface.
 */
export default function RoleRoute({ allow }) {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const allowed = Array.isArray(allow) ? allow : [allow];

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

  if (!allowed.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
