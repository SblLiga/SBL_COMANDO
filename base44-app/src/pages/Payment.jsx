import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { postAuthPath } from "@/lib/postAuth";
import { buildGrowPaymentUrl } from "@/lib/paymentUrl";
import { Lock, ExternalLink, Loader2, CreditCard } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Payment() {
  const { user, checkUserAuth, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isStaff = user.role === "manager" || user.role === "admin";
  if (isStaff || user.subscription_status === "active") {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  const finishBypass = async (redirect = "/thank-you") => {
    await checkUserAuth?.();
    navigate(redirect, { replace: true });
  };

  const startCheckout = async () => {
    setStarting(true);
    try {
      // Local Vite dev server: backend bypasses payment (no Meshulam).
      if (import.meta.env.DEV) {
        const res = await apiClient.integrations.Make.triggerCheckout();
        if (res?.bypassed) {
          toast({
            title: "מצב בדיקה (DEV)",
            description: "הסליקה דולגה — ממשיכים לאתר.",
          });
          await finishBypass(res.redirect || "/thank-you");
          return;
        }
      }

      const url = buildGrowPaymentUrl(user.id);
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "מעבירים לסליקה",
        description:
          "פתחנו את דף התשלום. לאחר אישור חזרי לאתר — הסטטוס יתעדכן אוטומטית.",
      });
    } catch (err) {
      try {
        const bypass = await apiClient.integrations.Make.devActivate();
        toast({
          title: "מצב בדיקה (DEV)",
          description: "הסליקה דולגה — ממשיכים לאתר.",
        });
        await finishBypass(bypass?.redirect || "/thank-you");
        return;
      } catch {
        /* fall through */
      }
      toast({
        title: "סליקה עדיין לא מחוברת",
        description: err?.message || "נסי שוב מאוחר יותר.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-gold-rim p-8 text-center max-w-sm w-full space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <CreditCard className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold mb-2">הפעלת מנוי</h1>
          <p className="text-sm text-muted-foreground">
            כדי להמשיך לבחירת המשימות והגלגל, יש להשלים את תהליך הסליקה / הוראת הקבע.
          </p>
        </div>
        <button
          type="button"
          onClick={startCheckout}
          disabled={starting}
          className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          המשך לתשלום
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => navigate("/thank-you")}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          כבר שילמתי — בדיקת סטטוס
        </button>
      </div>
    </div>
  );
}
