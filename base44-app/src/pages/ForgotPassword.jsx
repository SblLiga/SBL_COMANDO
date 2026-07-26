import React, { useState } from "react";
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless (no email enumeration)
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
            אם קיים חשבון עם כתובת זו — נשלח מייל עם קישור לאיפוס. בדק/י גם בספאם.
          </p>
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
