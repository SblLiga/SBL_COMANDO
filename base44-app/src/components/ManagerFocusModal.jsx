import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Target, X } from "lucide-react";
import { isManagerTargetSelectionWindow } from "@/lib/calendarRules";

const TARGETS = [
  { name: "שיווק", sub: "מסרים שמוכרים בלי להתנצל" },
  { name: "אוטומציות", sub: "מערכת שעובדת בלי שינה" },
  { name: "מכירות", sub: "סגירות על בסיס יוזמה" },
  { name: "ניהול זמן", sub: "שעות שעובדות בשבילך" },
  { name: "מגנט לידים", sub: "לידים שבאים לבד" },
  { name: "שיפור מוצר קיים", sub: "הצעה שקשה לסרב לה" },
  { name: "בניית מוצר חדש", sub: "הצעה שקשה לסרב לה" },
  { name: "כלכלי", sub: "מספרים שמספרים את האמת" },
  { name: "אחר", sub: "מגדירים את הקרב" },
];

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

export default function ManagerFocusModal() {
  const [user, setUser] = useState(null);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.auth
      .me()
      .then((u) => {
        setUser(u);
        if (u?.role !== "manager" && u?.role !== "admin") return;
        const due = isManagerTargetSelectionWindow();
        const alreadySet = u?.focus_month === currentMonthKey() && u?.focus_target;
        if (due && !alreadySet) {
          setShow(true);
          setSelected(u?.focus_target || "");
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.auth.updateMe({
        focus_target: selected,
        focus_month: currentMonthKey(),
      });
      setShow(false);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
      <div className="card-gold-rim p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full gold-gradient flex items-center justify-center mx-auto mb-3">
            <Target className="w-7 h-7 text-black" />
          </div>
          <h2 className="font-display text-xl font-bold">על מה נלחמים החודש?</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            בחרו מנוע צמיחה אחד. רק אחד. זה מה שיזיז את המחט.
          </p>
        </div>
        <div className="space-y-2 mb-5">
          {TARGETS.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelected(t.name)}
              className={`w-full text-right p-3 rounded-xl transition-all ${
                selected === t.name ? "gold-bg text-black" : "bg-muted text-muted-foreground"
              }`}
            >
              <p className="text-sm font-bold">{t.name}</p>
              <p className={`text-[11px] ${selected === t.name ? "text-black/70" : "text-muted-foreground/80"}`}>
                {t.sub}
              </p>
            </button>
          ))}
        </div>
        <button
          onClick={save}
          disabled={!selected || saving}
          className="w-full gold-bg text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40"
        >
          {saving ? "שומר..." : "מגדירים את הקרב ←"}
        </button>
      </div>
    </div>
  );
}