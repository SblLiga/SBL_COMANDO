import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TARGETS = [
  "שיווק",
  "אוטומציות",
  "מכירות",
  "ניהול זמן",
  "מגנט לידים",
  "שיפור מוצר קיים",
  "בניית מוצר חדש",
  "כלכלי",
  "אחר",
];

export default function ManagerGoalSelection() {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setMember(me);

        if (me?.role !== "manager") return;

        const today = new Date();
        const day = today.getDate();

        // Show on the 23rd or later
        if (day < 23) return;

        // Check if already selected this month
        if (me.next_month_selected_at) {
          const selectedDate = new Date(me.next_month_selected_at);
          if (
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear()
          ) {
            return; // Already selected this month
          }
        }

        setShow(true);
      } catch (err) {
        console.error("[ManagerGoalSelection]", err);
      }
    })();
  }, []);

  const save = async () => {
    if (!selected || !member) return;
    setSaving(true);
    try {
      await apiClient.entities.Member.update(member.id, {
        next_month_target: selected,
        next_month_selected_at: new Date().toISOString(),
      });
      toast({ title: "היעד נשמר", description: `היעד לחודש הבא נקבע ל: ${selected}` });
      setShow(false);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4">
      <div className="card-gold-rim p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shrink-0">
            <Target className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">אזור מנהל</p>
            <h2 className="font-display text-lg font-bold">בחירת יעד לחודש הבא</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">יש לבחור את היעד שעליו תנהל/י בחודש הבא</p>

        <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
          {TARGETS.map((t) => (
            <button
              key={t}
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
          onClick={save}
          disabled={!selected || saving}
          className="w-full gold-bg text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40"
        >
          {saving ? "שומר..." : "אישור ושמירה"}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground py-2"
        >
          דלג לעכשיו
        </button>
        <a
          href="https://wa.me/972500000000"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs text-primary hover:underline mt-2"
        >
          צריכים עזרה? צרו קשר עם שולי
        </a>
      </div>
    </div>
  );
}