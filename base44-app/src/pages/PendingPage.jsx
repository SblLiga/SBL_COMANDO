import React from "react";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Hard lock for wait-window payers (subscription_start_date in the future).
 * No access to home/dashboard until the 25th.
 */
export default function PendingPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background" dir="rtl">
      <div className="card-gold-rim p-8 text-center max-w-md w-full space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold">החשבון מוקפא זמנית</h1>
          <p className="text-base font-medium leading-relaxed">
            חשבונך מוקפא עד פתיחת השיבוצים ב-25 בחודש
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            המנוי פעיל וההרשמה נקלטה. ב־25 לחודש תוכלו להיכנס ולהשתבץ לקבוצה.
          </p>
        </div>
        <button
          type="button"
          onClick={() => logout(true)}
          className="w-full border border-border rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 hover:bg-muted/60 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          התנתקות
        </button>
      </div>
    </div>
  );
}
