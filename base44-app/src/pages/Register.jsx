import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import { postAuthPath } from "@/lib/postAuth";

export default function Register() {
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(params.get("verify") === "true");
  const [otpCode, setOtpCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [screenOtp, setScreenOtp] = useState("");

  useEffect(() => {
    // Coming from login (unverified) — auto-resend a fresh code
    if (params.get("verify") === "true" && params.get("email") && params.get("resend") !== "0") {
      const addr = params.get("email");
      apiClient.auth
        .resendOtp(addr)
        .then((res) => {
          setEmailSent(Boolean(res?.email_sent));
          if (res?.dev_otp) {
            setScreenOtp(String(res.dev_otp));
            setOtpCode(String(res.dev_otp));
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.auth.register({ email, password });
      setEmailSent(Boolean(res?.email_sent));
      if (res?.dev_otp) {
        setScreenOtp(String(res.dev_otp));
        setOtpCode(String(res.dev_otp));
      }
      setShowOtp(true);
      toast({
        title: res?.email_sent ? "הקוד נשלח למייל" : "קוד אימות מוכן",
        description: res?.dev_otp
          ? `הזיני את הקוד שמוצג למטה`
          : `שלחנו קוד אימות ל-${email}`,
      });
    } catch (err) {
      setError(err.message || "ההרשמה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await apiClient.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        apiClient.auth.setToken(result.access_token);
      }
      const me = await apiClient.auth.me();
      window.location.href = postAuthPath(me);
    } catch (err) {
      setError(err.message || "קוד אימות לא תקין");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const res = await apiClient.auth.resendOtp(email);
      setEmailSent(Boolean(res?.email_sent));
      if (res?.dev_otp) {
        setScreenOtp(String(res.dev_otp));
        setOtpCode(String(res.dev_otp));
      }
      toast({
        title: res?.email_sent ? "הקוד נשלח למייל" : "קוד חדש מוכן",
        description: res?.dev_otp
          ? `הקוד לעכשיו: ${res.dev_otp}`
          : `בדק/י את תיבת הדוא״ל של ${email} (וגם ספאם)`,
      });
    } catch (err) {
      setError(err.message || "שליחת הקוד נכשלה");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        title="אימות דוא״ל"
        subtitle={
          screenOtp
            ? "הקוד מוצג למטה (מצב פיתוח / גיבוי)"
            : `הזיני את הקוד שנשלח ל-${email}`
        }
        footerLink={{ prompt: "כבר יש לך חשבון מאומת?", to: "/login", label: "חזרה להתחברות" }}
      >
        {/* Only when backend returns screen fallback (DEV / mail failure with fallback on) */}
        {screenOtp ? (
          <div className="mb-5 rounded-2xl border-2 border-primary bg-primary/15 p-5 text-center shadow-[0_0_24px_rgba(212,175,55,0.25)]">
            <p className="text-sm font-bold text-primary mb-2">קוד האימות שלך</p>
            <p
              className="font-mono text-4xl sm:text-5xl font-black tracking-[0.4em] text-foreground leading-none py-2"
              dir="ltr"
            >
              {screenOtp}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              הקוד כבר הוזן בשדות — לחצי «אימות».
            </p>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-border bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              שלחנו קוד למייל{emailSent ? "" : " (אם החשבון קיים וממתין לאימות)"}. בדקי גם בספאם.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center mb-6" dir="ltr">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              מאמת...
            </>
          ) : (
            "אימות"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          לא רואה קוד?{" "}
          <button type="button" onClick={handleResend} className="text-primary font-medium hover:underline">
            שלח שוב
          </button>
        </p>
        <div className="mt-6 pt-4 border-t border-border text-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-muted text-sm font-medium hover:bg-accent transition-colors"
          >
            חזרה למשתמש קיים — התחברות
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="צר/י חשבון"
      subtitle="הירשמ/י כדי להתחיל"
      footerLink={{ prompt: "כבר יש לך חשבון?", to: "/login", label: "התחבר/י" }}
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
          <Label htmlFor="password">סיסמה</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">אישור סיסמה</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              יוצר חשבון...
            </>
          ) : (
            "צור חשבון"
          )}
        </Button>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full h-11 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          חזרה למשתמש קיים
        </Link>
      </form>
    </AuthLayout>
  );
}
