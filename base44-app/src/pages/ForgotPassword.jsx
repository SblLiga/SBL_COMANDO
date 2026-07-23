import React, { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.auth.resetPasswordRequest(email);
      setEmailSent(Boolean(res?.email_sent));
      if (res?.reset_url) setResetUrl(res.reset_url);
      else if (res?.reset_token) setResetUrl(`/reset-password?token=${encodeURIComponent(res.reset_token)}`);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      title="איפוס סיסמה"
      subtitle="נשלח אליך קישור לאיפוס"
      footerLink={{ prompt: "", to: "/login", label: "← חזרה להתחברות" }}
    >
      {sent ? (
        <div className="space-y-3 text-sm text-center">
          <p className="text-foreground">
            {emailSent
              ? "אם קיים חשבון עם כתובת זו — נשלח מייל עם קישור לאיפוס."
              : "אם קיים חשבון עם כתובת זו — נוצר קישור לאיפוס."}
          </p>
          {resetUrl && (
            <p className="text-xs break-all p-3 rounded-lg bg-primary/10 text-primary text-right">
              קישור DEV:{" "}
              <Link
                to={(() => {
                  try {
                    if (resetUrl.startsWith("http")) return new URL(resetUrl).pathname + new URL(resetUrl).search;
                  } catch {
                    /* ignore */
                  }
                  return resetUrl.startsWith("/") ? resetUrl : `/${resetUrl}`;
                })()}
                className="underline font-medium"
                dir="ltr"
              >
                לחצ/י כאן לאיפוס
              </Link>
            </p>
          )}
        </div>
      ) : (
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
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                שולח...
              </>
            ) : (
              "שלח קישור לאיפוס"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
