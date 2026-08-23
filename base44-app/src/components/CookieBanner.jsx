import React, { useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "sbl_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="הסכמה לשימוש בעוגיות"
      className="fixed bottom-0 inset-x-0 z-[80] p-3 sm:p-4"
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto card-gold-rim p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 shadow-lg">
        <p className="text-sm text-foreground/90 leading-relaxed flex-1">
          האתר משתמש בעוגיות כדי לשפר את חוויית השימוש. המשך גלישה מהווה הסכמה. פירוט ב
          <Link to="/privacy" className="text-primary font-semibold underline underline-offset-2 mx-1">
            מדיניות הפרטיות
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="gold-gradient text-black font-bold rounded-xl px-5 py-2.5 text-sm shrink-0"
        >
          אישור
        </button>
      </div>
    </div>
  );
}
