import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { postAuthPath } from "@/lib/postAuth";
import { isSubscriptionStartPending } from "@/lib/calendarRules";

function resolveReturnPath(searchParams, user, member = null) {
  const role = (user?.role || "user").toLowerCase();
  // Hard lock for deferred wait-window payers
  if (role === "user" && isSubscriptionStartPending(user)) {
    return user?.onboarding_completed ? "/pending" : "/onboarding";
  }
  // Incomplete registration (no wheel yet) always resumes onboarding
  if (role === "user" && !user?.onboarding_completed) {
    return "/onboarding";
  }
  const raw = searchParams.get("return");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return postAuthPath(user, member);
  }
  if (role === "admin" && raw.startsWith("/admin")) return raw;
  if (role === "manager" && raw.startsWith("/manager")) return raw;
  if (role === "user" && !raw.startsWith("/admin") && !raw.startsWith("/manager")) {
    return raw === "/" || raw === "/goal" ? postAuthPath(user, member) : raw;
  }
  return postAuthPath(user, member);
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showVerifyButton, setShowVerifyButton] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowVerifyButton(false);
    setLoading(true);
    try {
      await apiClient.auth.loginViaEmailPassword(email, password);
      const u = await apiClient.auth.me();
      let member = null;
      try {
        if (u?.role === "user" && u?.subscription_status === "active") {
          const rows = await apiClient.entities.Member.filter({ user_id: u.id });
          member = rows[0] || null;
        }
      } catch {
        member = null;
      }
      window.location.href = resolveReturnPath(searchParams, u, member);
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      const needsEmailVerify =
        msg.includes("not verified") ||
        msg.includes("email not verified") ||
        (err.status === 403 && msg.includes("verif"));
      if (needsEmailVerify) {
        window.location.href = `/register?verify=true&email=${encodeURIComponent(email)}`;
        return;
      }
      setError(err.message || "אימייל או סיסמה לא תקינים");
      // Only offer verify jump when the error is clearly about email verification
      setShowVerifyButton(needsEmailVerify || msg.includes("verif"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="ברוך שובך"
      subtitle="התחבר/י לחשבון שלך"
      footerLink={{ prompt: "אין לך חשבון?", to: "/register", label: "צר/י חשבון" }}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
          {showVerifyButton && email && (
            <button
              type="button"
              onClick={() => {
                window.location.href = `/register?verify=true&email=${encodeURIComponent(email)}`;
              }}
              className="mt-2 block w-full bg-destructive text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              מעבר לאימות כתובת המייל ←
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">דוא״ל</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">סיסמה</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline relative z-10">
              שכחת סיסמה?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              מתחבר...
            </>
          ) : (
            "התחבר/י"
          )}
        </Button>
        <Link
          to="/register"
          className="inline-flex items-center justify-center w-full h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors relative z-10"
        >
          משתמש חדש — צר/י חשבון
        </Link>
      </form>
    </AuthLayout>
  );
}
