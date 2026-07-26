import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { needsOnboardingWizard, postAuthPath } from "@/lib/postAuth";
import { CheckCircle2, Loader2, PartyPopper } from "lucide-react";

export default function ThankYou() {
  const { user, checkUserAuth, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [polling, setPolling] = useState(true);
  const [status, setStatus] = useState(user?.subscription_status || "inactive");
  const [latestUser, setLatestUser] = useState(user);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const tick = async () => {
      try {
        const u = await apiClient.auth.me();
        if (cancelled) return;
        setLatestUser(u);
        const next = u?.subscription_status || "inactive";
        setStatus(next);
        if (u?.role === "user") {
          const rows = await apiClient.entities.Member.filter({ user_id: u.id });
          if (!cancelled) setMember(rows[0] || null);
        }
        if (next === "active") {
          await checkUserAuth?.();
          if (!cancelled) setPolling(false);
          return;
        }
      } catch {
        /* keep polling briefly */
      }
      tries += 1;
      if (tries >= 12) {
        if (!cancelled) setPolling(false);
        return;
      }
      if (!cancelled) setTimeout(tick, 2500);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [checkUserAuth]);

  if (isLoadingAuth && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const activeUser = latestUser || user;
  const isActive = status === "active";
  const continuePath = isActive
    ? needsOnboardingWizard(activeUser, member)
      ? "/onboarding"
      : postAuthPath(activeUser, member)
    : "/payment";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-gold-rim p-8 text-center max-w-sm w-full space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          {isActive ? (
            <PartyPopper className="w-8 h-8 text-primary" />
          ) : (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
        </div>
        {isActive ? (
          <>
            <div>
              <h1 className="font-display text-xl font-bold mb-2">התשלום התקבל!</h1>
              <p className="text-sm text-muted-foreground">
                המנוי פעיל. אפשר להמשיך לבחירת המשימות ולהתחיל את המסע.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
              <CheckCircle2 className="w-4 h-4" /> סטטוס: ACTIVE
            </div>
            <button
              type="button"
              onClick={() => navigate(continuePath, { replace: true })}
              className="w-full gold-gradient text-black font-bold rounded-xl py-3 text-sm"
            >
              המשך לבחירת משימות
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-xl font-bold mb-2">ממתינים לאישור תשלום</h1>
              <p className="text-sm text-muted-foreground">
                {polling
                  ? "בודקים מול השרת שהתשלום אושר…"
                  : "עדיין לא קיבלנו אישור. אם שילמת — חכי רגע או חזרי מדף הסליקה."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/payment", { replace: true })}
              className="w-full border border-border rounded-xl py-3 text-sm font-medium"
            >
              חזרה לסליקה
            </button>
          </>
        )}
      </div>
    </div>
  );
}
