import React from "react";
import { Users, Check, MessageCircle } from "lucide-react";

export default function StepManager({ managers, groups, gender, target, manager, setManager }) {
  const filteredManagers = managers.filter(
    (m) => m.role === "manager" && (!gender || m.gender === gender) && (!target || m.target === target)
  );

  const managerCapacity = (mgr) => {
    const mgrGroups = groups.filter((g) => g.manager_name === mgr.name);
    const count = mgrGroups.reduce((s, g) => s + (g.participant_count || 0), 0);
    return { count, full: count >= 5 };
  };

  const hasManagers = filteredManagers.length > 0;

  return (
    <>
      <div className="text-center">
        <Users className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחר/י מנהל/ת</h2>
        <p className="text-xs text-muted-foreground">{target} · {gender === "female" ? "נשים" : "גברים"}</p>
      </div>

      {hasManagers ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filteredManagers.map((m) => {
            const cap = managerCapacity(m);
            return (
              <button
                key={m.id}
                disabled={cap.full}
                onClick={() => setManager(m)}
                className={`w-full text-right p-3 rounded-xl flex items-center gap-3 transition-all ${
                  cap.full ? "bg-muted/50 opacity-50 cursor-not-allowed" : manager?.id === m.id ? "gold-bg text-black glow-gold" : "bg-muted"
                }`}
              >
                <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`} alt="" className="w-10 h-10 rounded-full ring-1 ring-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[10px] opacity-70">{cap.count}/5 משתתפים</p>
                </div>
                {cap.full && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">לא זמין</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <p className="text-center text-sm text-muted-foreground py-2">
            אין מנהל/ת זמין/ה עבור {target} כרגע.<br />מה תרצה/י לעשות?
          </p>

          <button
            onClick={() => setManager({ id: "waiting_list", name: "רשימת המתנה" })}
            className={`w-full text-right p-4 rounded-xl flex items-center gap-3 transition-all ${
              manager?.id === "waiting_list" ? "gold-bg text-black glow-gold" : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">הצטרף/י לרשימת המתנה</p>
              <p className="text-[10px] opacity-70">נשבץ אותך לקבוצה ברגע שיהיה מנהל זמין</p>
            </div>
            {manager?.id === "waiting_list" && <Check className="w-5 h-5 shrink-0" />}
          </button>

          <a
            href="https://wa.me/972500000000"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-4 rounded-xl flex items-center gap-3 transition-all bg-muted hover:bg-muted/80"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">צרו קשר עם שולי</p>
              <p className="text-[10px] opacity-70">רוצה לנהל את {target}? דבר/י איתנו</p>
            </div>
          </a>
        </div>
      )}
    </>
  );
}