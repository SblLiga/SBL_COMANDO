import React, { useEffect } from "react";
import { Users, Check, MessageCircle, Clock, LogOut } from "lucide-react";
import { canAssignToGroup } from "@/lib/calendarRules";
import { getMatchingManagers } from "@/lib/managerCandidates";
import UserAvatar from "@/components/UserAvatar";

export default function StepManager({
  user,
  managers,
  groups,
  gender,
  target,
  manager,
  setManager,
  onBackToTarget,
  onLogout,
  onBlockedChange,
}) {
  // Payment (active) ≠ assignment. Assignment only on days 25–26 when not deferred-pending.
  const assignmentOpen = canAssignToGroup(user);

  // Fail closed on gender/target and show one row per manager user.
  const uniqueManagers = getMatchingManagers(managers, { gender, target });

  const managerCapacity = (mgr) => {
    const mgrUserId = mgr?.user_id;
    if (!mgrUserId) return { count: 0, full: false };
    const mgrGroups = groups.filter((g) => String(g.manager_id) === String(mgrUserId));
    // Capacity is per target + gender, not across all of a manager's groups.
    const scoped = mgrGroups.filter(
      (g) =>
        (!target || g.target === target) &&
        (!gender || g.gender === gender)
    );
    const count = scoped.reduce((s, g) => s + (g.participant_count || 0), 0);
    return { count, full: count >= 5 };
  };

  const hasManagers = uniqueManagers.length > 0;
  const allFull = hasManagers && uniqueManagers.every((m) => managerCapacity(m).full);
  const noManagerAvailable = assignmentOpen && (!hasManagers || allFull);

  useEffect(() => {
    if (!assignmentOpen) {
      setManager({ id: "waiting_list", name: "רשימת המתנה" });
      onBlockedChange?.(false);
      return;
    }
    // Block continue when no slot: clear legacy waiting_list so canNext stays false.
    if (noManagerAvailable && manager?.id === "waiting_list") {
      setManager(null);
    }
    onBlockedChange?.(noManagerAvailable);
  }, [assignmentOpen, noManagerAvailable, manager?.id, setManager, onBlockedChange]);

  if (!assignmentOpen) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold">הרשמה נקלטה</h2>
        </div>
        <div className="rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 space-y-3 text-center">
          <Check className="w-8 h-8 text-primary mx-auto" />
          <p className="text-base font-bold leading-snug">
            הרשמתך נקלטה בהצלחה! המנוי שלך פעיל.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            חלון השיבוץ לקבוצות יפתח ב-25 בחודש.
          </p>
          {(target || gender) && (
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/20">
              יעד: {target || "—"} · {gender === "female" ? "נשים" : gender === "male" ? "גברים" : "—"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <Users className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחר/י מנהל/ת</h2>
        <p className="text-xs text-muted-foreground">{target} · {gender === "female" ? "נשים" : "גברים"}</p>
      </div>

      {!noManagerAvailable ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {uniqueManagers.map((m) => {
            const cap = managerCapacity(m);
            return (
              <button
                key={m.user_id || m.id}
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

          <a
            href="https://wa.me/972504170707"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-4 rounded-xl flex items-center gap-3 transition-all bg-muted hover:bg-muted/80"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-bold">תהיה/י המנהל/ת! צור/י קשר עם שולי בן לולו לפתיחת הקבוצה</p>
            </div>
          </a>

          <button
            type="button"
            onClick={() => onBackToTarget?.()}
            className="w-full p-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-border hover:bg-muted/60"
          >
            <p className="text-sm font-bold">או חזור לבחירת יעד אחר</p>
          </button>

          <button
            type="button"
            onClick={() => onLogout?.()}
            className="w-full p-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-border hover:bg-muted/60"
          >
            <LogOut className="w-4 h-4" />
            <p className="text-sm font-bold">התנתקות</p>
          </button>
        </div>
      )}
    </>
  );
}
