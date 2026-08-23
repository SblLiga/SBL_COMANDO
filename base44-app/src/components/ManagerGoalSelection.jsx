import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { needsManagerNextMonthTarget } from "@/lib/calendarRules";

const TARGETS = [
  "שיווק",
  "יעד אישי",
  "מכירות",
  "אוטומציות",
  "ניהול זמן",
  "מגנט לידים",
  "שיפור מוצר קיים",
  "בניית מוצר חדש",
  "אחר",
];

/**
 * Hard gate from day ≥ 23 until next_month_target is chosen for this month.
 * No skip / close — ManagerLayout hides the rest of the UI while locked.
 */
export default function ManagerGoalSelection({ onGateState } = {}) {
  const { toast } = useToast();
  const { checkUserAuth } = useAuth();
  const [locked, setLocked] = useState(true);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);

  const emit = (nextLocked, nextReady = true) => {
    setLocked(nextLocked);
    setReady(nextReady);
    onGateState?.({ locked: nextLocked, ready: nextReady });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await apiClient.auth.me();
        // Fresh role from server — avoid stale JWT/session treating admin/manager as user.
        if (String(user?.role || "").toLowerCase() === "admin") {
          if (!cancelled) emit(false, true);
          return;
        }
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0] || null;
        if (cancelled) return;
        setMember(me);

        const role = String(user?.role || me?.role || "").toLowerCase();
        if (role !== "manager") {
          emit(false, true);
          return;
        }

        if (needsManagerNextMonthTarget(me || { role: "manager" })) {
          emit(true, true);
          return;
        }
        emit(false, true);
      } catch (err) {
        console.error("[ManagerGoalSelection]", err);
        if (!cancelled) emit(true, true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!selected || !member) return;
    setSaving(true);
    try {
      const updated = await apiClient.entities.Member.update(member.id, {
        // Keep current-cycle target for matching; next_month_* is the day-23 choice for 25–26.
        target: selected,
        next_month_target: selected,
        next_month_selected_at: new Date().toISOString(),
      });
      setMember(updated);
      if (member.user_id) {
        try {
          await apiClient.entities.User.update(member.user_id, { target: selected });
        } catch {
          /* role/target on User is optional */
        }
      }
      try {
        await checkUserAuth?.();
      } catch {
        /* non-blocking refresh */
      }
      toast({ title: "היעד נשמר", description: `היעד לניהול נקבע ל: ${selected}` });
      emit(false, true);
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !locked) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4">
      <div className="card-gold-rim p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shrink-0">
            <Target className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">אזור מנהל · חובה מיום 23</p>
            <h2 className="font-display text-lg font-bold">בחירת יעד לחודש הבא</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          יש לבחור יעד ניהול לחודש הבא ולאשר. לא ניתן לדלג — רק אחרי האישור ייפתח אזור המנהל.
        </p>

        <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelected(t)}
              className={`w-full text-right p-3 rounded-xl text-sm font-medium transition-colors ${
                selected === t ? "gold-bg text-black" : "bg-muted hover:bg-accent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!selected || saving}
          className="w-full gold-bg text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40"
        >
          {saving ? "שומר..." : "אישור ושמירה"}
        </button>
      </div>
    </div>
  );
}
