import React, { useEffect } from "react";
import { Users, Check, MessageCircle, Clock } from "lucide-react";
import { canAssignToGroup } from "@/lib/calendarRules";
import UserAvatar from "@/components/UserAvatar";

export default function StepManager({
  user,
  managers,
  groups,
  gender,
  target,
  manager,
  setManager,
}) {
  // Payment (active) ≠ assignment. Assignment only on days 25–26 when not deferred-pending.
  const assignmentOpen = canAssignToGroup(user);

  useEffect(() => {
    if (!assignmentOpen) {
      setManager({ id: "waiting_list", name: "רשימת המתנה" });
    }
  }, [assignmentOpen, setManager]);

  if (!assignmentOpen) {
    return (
      <>
        <div className="text-center">
          <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
          <h2 className="font-display text-xl font-bold">ממתינים לחלון השיבוץ</h2>
          <p className="text-xs text-muted-foreground mt-1">
            השיבוץ יתחדש ב-25 בחודש
          </p>
        </div>
        <div className="card-lux p-4 space-y-2">
          <p className="text-sm font-bold">השיבוץ לקבוצה סגור כרגע</p>
          <p className="text-xs text-muted-foreground">
            יעד: {target} · {gender === "female" ? "נשים" : "גברים"}.
            {user?.subscription_status === "active"
              ? " המנוי פעיל — אין צורך לשלם שוב. השיבוץ ייפתח ב־25–26 לחודש."
              : " לאחר תשלום מוצלח תוכלו להשתבץ בחלון השיבוץ (25–26)."}
          </p>
          <div className="flex items-center gap-2 text-xs text-primary">
            <Check className="w-4 h-4" /> רשימת המתנה נבחרה
          </div>
        </div>
      </>
    );
  }

  const filteredManagers = managers.filter(
    (m) => m.role === "manager" && (!gender || m.gender === gender) && (!target || m.target === target)
  );

  const managerCapacity = (mgr) => {
    const mgrGroups = groups.filter((g) => g.manager_name === mgr.name);
    const count = mgrGroups.reduce((s, g) => s + (g.participant_count || 0), 0);
    return { count, full: count >= 5 };
  };

  const hasManagers = filteredManagers.length > 0;
  const allFull = hasManagers && filteredManagers.every((m) => managerCapacity(m).full);

  return (
    <>
      <div className="text-center">
        <Users className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחר/י מנהל/ת</h2>
        <p className="text-xs text-muted-foreground">{target} · {gender === "female" ? "נשים" : "גברים"}</p>
      </div>

      {hasManagers && !allFull ? (
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
                <UserAvatar src={m.avatar_url} name={m.name} className="w-10 h-10 ring-1 ring-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[10px] opacity-70">{cap.count}/5 משתתפים</p>
                </div>
                {cap.full && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">מלא</span>}
                {!cap.full && manager?.id === m.id && <Check className="w-5 h-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <p className="text-center text-sm text-muted-foreground py-2">
            {allFull
              ? <>כל המנהלים/ות מלאים כרגע עבור {target}.<br />מה תרצה/י לעשות?</>
              : <>אין מנהל/ת זמין/ה עבור {target} כרגע.<br />מה תרצה/י לעשות?</>}
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
