import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { postAuthPath } from "@/lib/postAuth";

function resolveReturnPath(searchParams, user) {
  const role = (user?.role || "user").toLowerCase();
  // Incomplete registration (no wheel yet) always resumes onboarding
  if (role === "user" && !user?.onboarding_completed) {
    return "/onboarding";
  }
  const raw = searchParams.get("return");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return postAuthPath(user);
  }
  if (role === "admin" && raw.startsWith("/admin")) return raw;
  if (role === "manager" && raw.startsWith("/manager")) return raw;
  if (role === "user" && !raw.startsWith("/admin") && !raw.startsWith("/manager")) {
    return raw === "/" || raw === "/goal" ? postAuthPath(user) : raw;
  }
  return postAuthPath(user);
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient.auth.loginViaEmailPassword(email, password);
      const u = await apiClient.auth.me();
      window.location.href = resolveReturnPath(searchParams, u);
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("verif") || err.status === 403) {
        window.location.href = `/register?verify=true&email=${encodeURIComponent(email)}`;
        return;
      }
      setError(err.message || "אימייל או סיסמה לא תקינים");
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
