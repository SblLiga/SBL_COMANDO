import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Megaphone, Send, Users, UserCog, Check, Zap, Bell, AlertTriangle, TrendingUp, Award } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";

const alertTypeMeta = {
  danger: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "חוסר פעילות" },
  warning: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10", label: "עדכון מהמנהל" },
  success: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10", label: "עדכון ממשתמש" },
  info: { icon: Award, color: "text-primary", bg: "bg-primary/10", label: "הודעה / שידור" },
  nudge: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10", label: "תזכורת" },
};

export default function AdminAlerts() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [targets, setTargets] = useState({ all: false, managers: false, specificUser: false, specificManager: false });
  const [specificUserId, setSpecificUserId] = useState("");
  const [specificManagerId, setSpecificManagerId] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [n, m, users] = await Promise.all([
          apiClient.entities.Notification.list("-created_date", 30),
          apiClient.entities.Member.list(),
          apiClient.entities.User.list(),
        ]);
        const paidOrStaff = new Set(
          (users || [])
            .filter(
              (u) =>
                u.role === "manager" ||
                u.role === "admin" ||
                String(u.subscription_status || "").toLowerCase() === "active"
            )
            .map((u) => Number(u.id))
        );
        setNotifications(n);
        setMembers(
          (m || []).filter((row) => row.user_id == null || paidOrStaff.has(Number(row.user_id)))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const managers = members.filter((m) => m.role === "manager");
  const users = members.filter((m) => m.role === "user");

  const broadcast = async () => {
    if (!msg.trim()) {
      toast({ title: "נא להזין תוכן הודעה", variant: "destructive" });
      return;
    }
    let recipients = [];
    if (targets.all) {
      recipients = [...members];
    } else {
      if (targets.managers) recipients = recipients.concat(managers);
      if (targets.specificUser && specificUserId) {
        const u = members.find((m) => m.id === specificUserId);
        if (u) recipients.push(u);
      }
      if (targets.specificManager && specificManagerId) {
        const mgr = members.find((m) => m.id === specificManagerId);
        if (mgr) recipients.push(mgr);
      }
    }
    recipients = recipients.filter((m) => m.user_id);
    if (recipients.length === 0) {
      toast({ title: "בחר קהל יעד עם משתמש מקושר", variant: "destructive" });
      return;
    }
    await apiClient.entities.Notification.bulkCreate(
      recipients.map((m) => ({
        title: "שידור מערכתי",
        body: msg,
        type: "info",
        source: "סופר-אדמין",
        target_user_id: m.user_id,
      }))
    );
    toast({ title: "השידור נשלח! 📡", description: `${recipients.length} נמענים` });
    setMsg("");
    setShowBroadcast(false);
    setTargets({ all: false, managers: false, specificUser: false, specificManager: false });
    setSpecificUserId("");
    setSpecificManagerId("");
    const n = await apiClient.entities.Notification.list("-created_date", 30);
    setNotifications(n);
  };

  const markHandled = async (n) => {
    await apiClient.entities.Notification.update(n.id, { is_handled: true });
    setNotifications(notifications.filter((x) => x.id !== n.id));
    toast({ title: "ההתראה טופלה בהצלחה" });
  };

  const sendNudge = async (member) => {
    if (!member?.user_id) {
      toast({ title: "שגיאה", description: "לחבר זה אין משתמש מקושר", variant: "destructive" });
      return;
    }
    await apiClient.entities.Notification.create({
      title: "תזכורת מהנהלת המערכת",
      body: "הגיע הזמן לעדכן את הגלגל 🎯",
      type: "nudge",
      source: "סופר-אדמין",
      target_user_id: member.user_id,
    });
    toast({ title: "הנאדג׳ נשלח", description: `אל ${member.name}` });
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const activeAlerts = notifications.filter((n) => !n.is_handled);

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור אדמין" title="עדכונים והודעות" subtitle="מרכז הפיקוד — התראות ושידור" />

      <button onClick={() => setShowBroadcast(!showBroadcast)} className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm">
        <Megaphone className="w-4 h-4" /> שלח הודעה
      </button>

      {showBroadcast && (
        <div className="card-gold-rim p-4 space-y-3">
          <div className="space-y-2">
            {[
              { k: "all", l: "כולם", icon: Users },
              { k: "managers", l: "כל המנהלים", icon: UserCog },
              { k: "specificUser", l: "משתמש ספציפי", icon: Users },
              { k: "specificManager", l: "מנהל ספציפי", icon: UserCog },
            ].map(({ k, l, icon: Icon }) => (
              <div key={k}>
                <label className="flex items-center gap-3 card-lux p-2.5">
                  <input type="checkbox" checked={targets[k]} onChange={(e) => setTargets({ ...targets, [k]: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-sm">{l}</span>
                </label>
                {k === "specificUser" && targets.specificUser && (
                  <select value={specificUserId} onChange={(e) => setSpecificUserId(e.target.value)} className="w-full bg-input rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">בחר משתמש...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {k === "specificManager" && targets.specificManager && (
                  <select value={specificManagerId} onChange={(e) => setSpecificManagerId(e.target.value)} className="w-full bg-input rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">בחר מנהל...</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="תוכן ההודעה..." className="w-full bg-input rounded-lg p-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onClick={broadcast} className="w-full gold-bg text-black rounded-lg py-2.5 font-bold text-sm flex items-center justify-center gap-2"><Send className="w-4 h-4" /> שדר עכשיו</button>
        </div>
      )}

      {/* Alerts table */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">טבלת התראות ({activeAlerts.length})</h3>
        {activeAlerts.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">אין התראות פעילות</p>
        )}
        {activeAlerts.map((n) => {
          const meta = alertTypeMeta[n.type] || alertTypeMeta.info;
          const Icon = meta.icon;
          const member = members.find((m) => m.user_id === n.target_user_id || m.id === n.target_user_id);
          const daysInactive = member ? Math.floor((Date.now() - new Date(member.updated_date)) / 86400000) : "—";
          return (
            <div key={n.id} className={`card-lux p-3 ${meta.bg}`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 ${meta.color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {member?.name || n.source || "—"} · {member?.group_name || "—"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">אחוז: {member?.progress || 0}%</span>
                    <span className="text-[10px] text-muted-foreground">ימי חוסר: {daysInactive}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_date).toLocaleDateString("he-IL")}</span>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{n.body}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {member && (
                  <button onClick={() => sendNudge(member)} className="flex-1 text-xs py-1.5 rounded-lg bg-primary/15 text-primary flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" /> שליחת Nudge
                  </button>
                )}
                <button onClick={() => markHandled(n)} className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/15 text-green-500 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> סמן כטופל
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}