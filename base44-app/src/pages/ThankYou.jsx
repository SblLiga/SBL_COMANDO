import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { postAuthPath } from "@/lib/postAuth";
import { canAssignToGroup } from "@/lib/calendarRules";
import { CheckCircle2, Loader2, PartyPopper } from "lucide-react";

export default function ThankYou() {
  const { user, isLoadingAuth, applyUser } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [polling, setPolling] = useState(() => apiClient.auth.isAuthenticated());
  const [status, setStatus] = useState(user?.subscription_status || "inactive");
  const [latestUser, setLatestUser] = useState(user);
  // Once payment success is confirmed, freeze UI — never re-enter loading/polling.
  const settledRef = useRef(user?.subscription_status === "active");
  const redirectedRef = useRef(false);
  const redirectTimerRef = useRef(null);

  const goAfterPayment = (u, row) => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const path = postAuthPath(u, row);
    redirectTimerRef.current = window.setTimeout(() => navigate(path, { replace: true }), 1200);
  };

  useEffect(() => {
    const loadMember = async (u) => {
      if (!u || u.role !== "user") return null;
      try {
        const rows = await apiClient.entities.Member.filter({ user_id: u.id });
        return rows[0] || null;
      } catch {
        return null;
      }
    };

    if (settledRef.current) {
      setPolling(false);
      setStatus("active");
      (async () => {
        const row = await loadMember(user);
        if (row) setMember(row);
        if (apiClient.auth.isAuthenticated()) goAfterPayment(user, row);
      })();
      return () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      };
    }

    // Guests / Grow: no session → no /auth/me polling (avoids repeated 401s).
    if (!apiClient.auth.isAuthenticated()) {
      setPolling(false);
      return;
    }

    // Already active in session — settle without calling checkUserAuth
    // (that sets isLoadingAuth=true and remounts App → spinner loop).
    if (user?.subscription_status === "active") {
      settledRef.current = true;
      setStatus("active");
      setPolling(false);
      (async () => {
        const row = await loadMember(user);
        if (row) setMember(row);
        goAfterPayment(user, row);
      })();
      return () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      };
    }

    let cancelled = false;
    let tries = 0;
    let timerId = null;

    const tick = async () => {
      if (cancelled || settledRef.current) return;
      try {
        const u = await apiClient.auth.me();
        if (cancelled || settledRef.current) return;
        const next = u?.subscription_status || "inactive";
        setLatestUser((prev) => (prev?.id === u?.id && prev?.subscription_status === next ? prev : u));
        setStatus((prev) => (prev === next ? prev : next));
        if (next === "active") {
          // Soft-patch AuthContext without flipping isLoadingAuth (avoids remount loop).
          applyUser?.(u);
          const row = await loadMember(u);
          if (!cancelled) {
            if (row) setMember((prev) => (prev?.id === row?.id ? prev : row));
            settledRef.current = true;
            setPolling(false);
            goAfterPayment(u, row);
          }
          return;
        }
      } catch {
        /* keep polling briefly */
      }
      if (cancelled || settledRef.current) return;
      tries += 1;
      if (tries >= 24) {
        setPolling(false);
        return;
      }
      timerId = setTimeout(tick, 2500);
    };

    tick();
    return () => {
      cancelled = true;
      if (timerId != null) clearTimeout(timerId);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
    // Mount-once only. Never depend on AuthContext function identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After success is settled, never show the auth loading spinner again.
  if (isLoadingAuth && !user && !settledRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const activeUser = latestUser || user;
  const isActive = settledRef.current || (Boolean(user || latestUser) && status === "active");
  const waitEnrollment = Boolean(activeUser) && isActive && !canAssignToGroup(activeUser);
  const continuePath = isActive ? postAuthPath(activeUser, member) : "/payment";

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
                {waitEnrollment
                  ? "המנוי פעיל. מעבירים להשלמת ההרשמה…"
                  : "המנוי פעיל. מעבירים לעמוד הראשי…"}
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
              {waitEnrollment ? "המשך להשלמת ההרשמה" : "המשך לבחירת משימות"}
            </button>
          </>
        ) : (
          <>
            <div>
              <h1 className="font-display text-xl font-bold mb-2">ממתינים לאישור תשלום</h1>
              <p className="text-sm text-muted-foreground">
                {polling
                  ? "בודקים מול השרת שהתשלום אושר…"
                  : "עדיין לא קיבלנו אישור. במידה ובוצע תשלום — אפשר להמתין כמה רגעים או לחזור מדף הסליקה."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(user ? "/payment" : "/login", { replace: true })}
              className="w-full border border-border rounded-xl py-3 text-sm font-medium"
            >
              {user ? "חזרה לסליקה" : "התחברות"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
