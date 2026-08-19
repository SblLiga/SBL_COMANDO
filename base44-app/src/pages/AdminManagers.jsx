import React, { useState, useEffect, useMemo } from "react";
import apiClient from "@/api/apiClient";
import { Calendar, Star } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import UserAvatar from "@/components/UserAvatar";

/**
 * Build admin-facing rows from Users + Members.
 * Paid users exist as User before onboarding creates a Member —
 * Shuli must still be able to promote them to manager.
 * Unpaid (inactive) users are hidden — they are not site members yet.
 */
function isVisibleToAdmin(user) {
  if (!user) return false;
  if (user.role === "admin") return false;
  // Managers always visible (staff). Everyone else only after payment.
  if (user.role === "manager") return true;
  return String(user.subscription_status || "").toLowerCase() === "active";
}

function buildRows(users, members) {
  const byUserId = new Map();
  for (const m of members) {
    if (m.user_id != null) byUserId.set(Number(m.user_id), m);
  }

  const rows = [];
  for (const u of users) {
    if (!isVisibleToAdmin(u)) continue;
    const member = byUserId.get(Number(u.id));
    const pending = Boolean(u.pending_manager) && u.role !== "manager";
    rows.push({
      key: `user-${u.id}`,
      user_id: u.id,
      member_id: member?.id ?? null,
      name: member?.name || u.full_name || u.email,
      email: u.email,
      avatar_url: member?.avatar_url || u.avatar_url,
      group_name: member?.group_name || null,
      role: u.role === "manager" ? "manager" : "user",
      pending_manager: pending,
      manager_effective_on: u.manager_effective_on || null,
      has_member: Boolean(member),
      subscription_status: u.subscription_status,
      gender: member?.gender || u.gender || null,
      target: member?.next_month_target || member?.target || u.target || null,
    });
  }

  // Orphan members (no linked user) — only managers (legacy); skip unpaid unknowns
  for (const m of members) {
    if (m.user_id != null) continue;
    if (m.role === "admin") continue;
    if (m.role !== "manager") continue;
    rows.push({
      key: `member-${m.id}`,
      user_id: null,
      member_id: m.id,
      name: m.name,
      email: null,
      avatar_url: m.avatar_url,
      group_name: m.group_name || null,
      role: "manager",
      pending_manager: false,
      manager_effective_on: null,
      has_member: true,
    });
  }

  return rows.sort((a, b) => {
    const rank = (r) => (r.role === "manager" || r.pending_manager ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return String(a.name).localeCompare(String(b.name), "he");
  });
}

export default function AdminManagers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showSched, setShowSched] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(1.5);

  const load = async () => {
    const [u, m] = await Promise.all([
      apiClient.entities.User.list(),
      apiClient.entities.Member.list(),
    ]);
    setUsers(u);
    setMembers(m);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => buildRows(users, members), [users, members]);
  const managerCount = rows.filter((r) => r.role === "manager").length;
  const pendingCount = rows.filter((r) => r.pending_manager).length;

  const toggleRole = async (row) => {
    const nominated = row.role === "manager" || row.pending_manager;
    const newRole = nominated ? "user" : "manager";
    setBusyId(row.key);
    try {
      let updatedUser = null;
      if (row.user_id) {
        updatedUser = await apiClient.entities.User.update(row.user_id, {
          role: newRole,
        });
      }

      // Live demote only: keep Member.role aligned. Do not promote Member
      // until the backend actually sets User.role = manager (the 25th).
      if (row.member_id && newRole === "user") {
        await apiClient.entities.Member.update(row.member_id, { role: "user" });
      }

      await load();
      const pending = Boolean(updatedUser?.pending_manager);
      toast({
        title: nominated
          ? "הורד/ה למשתמש/ת"
          : pending
            ? "סומן/ה למנהל/ת מה-25"
            : "קודם/ה למנהל/ת! ⭐",
        description: pending
          ? `${row.name} נשאר/ת משתמש/ת בקבוצה עד ה-25`
          : row.name,
      });
    } catch (err) {
      console.error("[AdminManagers] toggleRole failed:", err);
      toast({
        title: "שגיאה",
        description: err.message || "עדכון התפקיד נכשל",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const schedule = async () => {
    if (!date || !startTime) {
      toast({ title: "חסרים פרטים", description: "נא למלא תאריך ושעת התחלה", variant: "destructive" });
      return;
    }
    const dayName = new Date(`${date}T${startTime}`).toLocaleDateString("he-IL", { weekday: "long" });
    const managersOnly = rows.filter((r) => r.role === "manager" && !r.pending_manager && r.user_id);
    try {
      await apiClient.entities.Notification.bulkCreate(
        managersOnly.map((m) => ({
          target_user_id: m.user_id,
          title: "נקבעה פגישה עם שולי",
          body: `נקבעה פגישה עם שולי ל${dayName} ${startTime}`,
          type: "info",
          source: "סופר-אדמין",
        }))
      );
      toast({ title: "נקבעה פגישה עם שולי ✅", description: `${dayName} בשעה ${startTime} · ${duration} שעות` });
      setShowSched(false);
      setDate("");
      setStartTime("");
    } catch (err) {
      toast({ title: "שגיאה בשליחה", description: "לא הצלחנו לשדר את ההודעות", variant: "destructive" });
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-4 space-y-5">
      <PageHeader
        badge="אזור אדמין"
        title="מנהלות"
        subtitle={`${managerCount} מנהלות${pendingCount ? ` · ${pendingCount} מה-25` : ""} · ${rows.length} משלמים/פעילים`}
      />

      <button
        type="button"
        onClick={() => setShowSched(!showSched)}
        className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
      >
        <Calendar className="w-4 h-4" /> קבע פגישה
      </button>

      {showSched && (
        <div className="card-gold-rim p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">תאריך</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">שעת התחלה</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">משך</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {[1, 1.5, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`py-2 rounded-lg text-sm ${duration === d ? "gold-bg text-black font-bold" : "bg-muted"}`}
                >
                  {d}ש׳
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">סיום מחושב</span>
            <span className="font-bold gold-text">
              {startTime
                ? new Date(new Date(`2000-01-01T${startTime}`).getTime() + duration * 3600000).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <button type="button" onClick={schedule} className="w-full gold-bg text-black rounded-lg py-2.5 font-bold text-sm">
            אשר ושדר
          </button>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">אין משתמשים להצגה עדיין</p>
        )}
        {rows.map((m) => (
          <div key={m.key} className="card-lux p-3 flex items-center gap-3">
            <div className="relative">
              <UserAvatar src={m.avatar_url} name={m.name} className="w-10 h-10 ring-1 ring-border" />
              {(m.role === "manager" || m.pending_manager) && (
                <Star className="absolute -top-1 -left-1 w-4 h-4 text-primary fill-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-[10px] text-muted-foreground truncate" dir="ltr">
                {m.email || m.group_name || "—"}
              </p>
              {!m.has_member && (
                <p className="text-[10px] text-orange-400">טרם השלים/ה אונבורדינג · ניתן לקדם למנהל/ת</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`text-[10px] font-bold ${
                  m.role === "manager" || m.pending_manager ? "gold-text" : "text-muted-foreground"
                }`}
              >
                {m.pending_manager ? "מנהל/ת מה-25" : m.role === "manager" ? "מנהל/ת" : "משתמש/ת"}
              </span>
              <Switch
                checked={m.role === "manager" || m.pending_manager}
                disabled={busyId === m.key}
                onCheckedChange={() => toggleRole(m)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
