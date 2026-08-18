import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import { Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute, { homePathForRole } from "@/components/RoleRoute";
import Layout from "@/components/Layout";
import ManagerLayout from "@/components/ManagerLayout";
import AdminLayout from "@/components/AdminLayout";
import Home from "@/pages/Home";
import GoalPage from "@/pages/Goal";
import League from "@/pages/League";
import HQ from "@/pages/HQ";
import Messages from "@/pages/Messages";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ManagerDashboard from "@/pages/ManagerDashboard";
import ManagerGroup from "@/pages/ManagerGroup";
import ManagerMeeting from "@/pages/ManagerMeeting";
import ManagerManagers from "@/pages/ManagerManagers";
import ManagerAlerts from "@/pages/ManagerAlerts";
import Onboarding from "@/pages/Onboarding";
import Profile from "@/pages/Profile";
import Payment from "@/pages/Payment";
import ThankYou from "@/pages/ThankYou";
import PendingPage from "@/pages/PendingPage";
import SubscriptionGate from "@/components/SubscriptionGate";
import PendingEnrollmentGate from "@/components/PendingEnrollmentGate";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminWheel from "@/pages/AdminWheel";
import AdminManagers from "@/pages/AdminManagers";
import AdminReports from "@/pages/AdminReports";
import AdminAlerts from "@/pages/AdminAlerts";

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathForRole(user?.role)} replace />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Never call window.location during render — that causes an infinite reload flicker.
  // Public auth pages stay reachable; ProtectedRoute handles unauthenticated users.
  if (authError?.type === "user_not_registered") {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/thank-you" element={<ThankYou />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/payment" element={<Payment />} />

        {/* Wait-window hard lock: only /pending (and incomplete /onboarding) allowed */}
        <Route element={<PendingEnrollmentGate />}>
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/profile" element={<Profile />} />

          {/* USER interface */}
          <Route element={<RoleRoute allow="user" />}>
            <Route element={<SubscriptionGate />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/goal" element={<GoalPage />} />
                <Route path="/league" element={<League zoneBadge="אזור משתמש" readOnly />} />
                <Route path="/hq" element={<HQ />} />
                <Route path="/messages" element={<Messages />} />
              </Route>
            </Route>
          </Route>

          {/* MANAGER interface */}
          <Route element={<RoleRoute allow="manager" />}>
            <Route element={<ManagerLayout />}>
              <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/manager/goal" element={<GoalPage />} />
              <Route path="/manager/group" element={<ManagerGroup />} />
              <Route path="/manager/managers" element={<ManagerManagers />} />
              <Route path="/manager/league" element={<League zoneBadge="אזור מנהל" readOnly={false} />} />
              <Route path="/manager/meeting" element={<ManagerMeeting />} />
              <Route path="/manager/alerts" element={<ManagerAlerts />} />
            </Route>
          </Route>

          {/* ADMIN interface */}
          <Route element={<RoleRoute allow="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/my-goal" element={<GoalPage />} />
              <Route path="/admin/wheel" element={<AdminWheel />} />
              <Route path="/admin/league" element={<League zoneBadge="אזור אדמין" readOnly={false} />} />
              <Route path="/admin/managers" element={<AdminManagers />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/alerts" element={<AdminAlerts />} />
            </Route>
          </Route>

          {/* Authenticated but unknown path → role home */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App