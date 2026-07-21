import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Lock, ExternalLink, ShieldAlert } from "lucide-react";

const GROW_PAYMENT_URL = "https://grow.co.il/subscribe";

export default function SubscriptionGate() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Subscription gate — block inactive participants
  if (user.subscription_status === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-gold-rim p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-xl font-bold mb-2">המנוי אינו פעיל</h1>
          <p className="text-sm text-muted-foreground mb-6">
            כדי להמשיך ולהשתמש בפלטפורמת ליגת הכובשים, יש לחדש את המנוי ב-GROW.
          </p>
          <a
            href={GROW_PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
          >
            <Lock className="w-4 h-4" /> חידוש מנוי ב-GROW
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // Onboarding gate — must complete before entering the app
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}