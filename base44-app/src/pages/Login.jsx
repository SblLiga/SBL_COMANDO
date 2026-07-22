import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

function resolveReturnPath(searchParams) {
  const raw = searchParams.get("return");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function redirectAfterLogin(user, returnPath) {
  if (user.role === "admin") {
    window.location.href = returnPath.startsWith("/admin") ? returnPath : "/admin";
    return;
  }
  if (user.role === "manager") {
    window.location.href = returnPath.startsWith("/manager") ? returnPath : "/manager";
    return;
  }
  window.location.href = returnPath;
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const returnPath = resolveReturnPath(searchParams);
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
      try {
        const myMembers = await apiClient.entities.Member.filter({ user_id: u.id });
        if (myMembers[0]?.role === "manager" || u.role === "manager") {
          window.location.href = returnPath.startsWith("/manager") ? returnPath : "/manager";
          return;
        }
      } catch {
        // Role enrichment is optional; fall through to default redirect.
      }
      redirectAfterLogin(u, returnPath);
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
      icon={LogIn}
      title="ברוך שובך"
      subtitle="התחבר/י לחשבון שלך"
      footer={
        <>
          אין לך חשבון?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            צר/י חשבון
          </Link>
        </>
      }
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
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
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
      </form>
    </AuthLayout>
  );
}
