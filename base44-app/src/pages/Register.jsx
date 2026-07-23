import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(params.get("verify") === "true");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Coming from login (unverified) — auto-resend a fresh code
    if (params.get("verify") === "true" && params.get("email") && params.get("resend") !== "0") {
      const addr = params.get("email");
      apiClient.auth
        .resendOtp(addr)
        .then((res) => {
          setEmailSent(Boolean(res?.email_sent));
          if (res?.dev_otp) setDevOtp(res.dev_otp);
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
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      setShowOtp(true);
      if (res?.email_sent) {
        toast({ title: "הקוד נשלח", description: `נשלח ל-${email}` });
      } else {
        toast({
          title: "קוד אימות נוצר",
          description: res?.dev_otp
            ? `המייל עדיין לא מוגדר בשרת — השתמשי בקוד: ${res.dev_otp}`
            : "בדקי את תיבת הדוא״ל או השתמשי בקוד 000000 בסביבת DEV",
        });
      }
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
      window.location.href = "/";
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
      if (res?.dev_otp) setDevOtp(res.dev_otp);
      toast({
        title: res?.email_sent ? "הקוד נשלח למייל" : "קוד חדש נוצר",
        description: res?.email_sent
          ? `בדוק/י את תיבת הדוא״ל של ${email}`
          : res?.dev_otp
            ? `קוד DEV: ${res.dev_otp}`
            : "השתמש/י ב-000000 בסביבת DEV",
      });
    } catch (err) {
      setError(err.message || "שליחת הקוד נכשלה");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="אימות דוא״ל"
        subtitle={emailSent ? `שלחנו קוד ל-${email}` : `קוד אימות עבור ${email}`}
        footer={
          <>
            כבר יש לך חשבון מאומת?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline relative z-10">
              חזרה להתחברות
            </Link>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {devOtp ? (
          <p className="text-xs text-center mb-3 p-2 rounded-lg bg-primary/10 text-primary" dir="ltr">
            קוד DEV להדגמה: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
            <span className="block text-muted-foreground mt-1">(או 000000)</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center mb-3">
            {emailSent
              ? "בדק/י את תיבת הדוא״ל (וגם ספאם)."
              : <>ב-DEV אפשר גם קוד <span dir="ltr" className="font-mono">000000</span></>}
          </p>
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
          לא קיבלת את הקוד?{" "}
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
      icon={UserPlus}
      title="צר/י חשבון"
      subtitle="הירשמ/י כדי להתחיל"
      footer={
        <>
          כבר יש לך חשבון?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline relative z-10">
            התחבר/י
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
