import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Megaphone, Send, Users, UserCog, Check, Bell, AlertTriangle, TrendingUp, Award, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";
import { sortNewestFirst } from "@/lib/utils";
import { formatNotificationSender, resolveReplyTargetUserId } from "@/lib/notificationSender";

const alertTypeMeta = {
  danger: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "חוסר פעילות" },
  warning: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10", label: "עדכון מהמנהל" },
  success: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10", label: "עדכון ממשתמש" },
  info: { icon: Award, color: "text-primary", bg: "bg-primary/10", label: "הודעה / שידור" },
  nudge: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10", label: "תזכורת" },
};

function isAdminAuthored(n, adminUserId) {
  if (adminUserId != null && n.source_user_id != null && Number(n.source_user_id) === Number(adminUserId)) {
    return true;
  }
  // Legacy broadcasts without source_user_id still use this source stamp.
  if (n.source === "סופר-אדמין" && Number(n.target_user_id) !== Number(adminUserId)) {
    return true;
  }
  return false;
}

export default function AdminAlerts() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [usersById, setUsersById] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [targets, setTargets] = useState({ all: false, managers: false, specificUser: false, specificManager: false });
  const [specificUserId, setSpecificUserId] = useState("");
  const [specificManagerId, setSpecificManagerId] = useState("");
  const [msg, setMsg] = useState("");
  const [adminUserId, setAdminUserId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyMsg, setReplyMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [me, n, m, users] = await Promise.all([
          apiClient.auth.me(),
          apiClient.entities.Notification.list("-created_date", 50),
          apiClient.entities.Member.list(),
          apiClient.entities.User.list(),
        ]);
        setAdminUserId(me?.id ?? null);
        const userMap = new Map();
        (users || []).forEach((u) => userMap.set(Number(u.id), u));
        setUsersById(userMap);
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
        setNotifications(sortNewestFirst(n));
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
  const membersByUserId = new Map(
    members.filter((m) => m.user_id != null).map((m) => [Number(m.user_id), m])
  );
  const senderCtx = { usersById, membersByUserId };

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
        const u = members.find((m) => String(m.id) === String(specificUserId));
        if (u) recipients.push(u);
      }
      if (targets.specificManager && specificManagerId) {
        const mgr = members.find((m) => String(m.id) === String(specificManagerId));
        if (mgr) recipients.push(mgr);
      }
    }
    recipients = recipients.filter(
      (m) => m.user_id != null && Number(m.user_id) !== Number(adminUserId)
    );
    const seen = new Set();
    recipients = recipients.filter((m) => {
      const uid = Number(m.user_id);
      if (seen.has(uid)) return false;
      seen.add(uid);
      return true;
    });
    if (recipients.length === 0) {
      toast({ title: "בחר קהל יעד עם משתמש מקושר", variant: "destructive" });
      return;
    }
    await apiClient.entities.Notification.bulkCreate(
      recipients.map((m) => ({
        title: "שידור מהנהלה",
        body: msg,
        type: "info",
        source: "הנהלה",
        source_user_id: adminUserId || undefined,
        target_user_id: Number(m.user_id),
      }))
    );
    toast({ title: "השידור נשלח! 📡", description: `${recipients.length} נמענים` });
    setMsg("");
    setShowBroadcast(false);
    setTargets({ all: false, managers: false, specificUser: false, specificManager: false });
    setSpecificUserId("");
    setSpecificManagerId("");
    const n = await apiClient.entities.Notification.list("-created_date", 50);
    setNotifications(sortNewestFirst(n));
  };

  const markHandled = async (n) => {
    await apiClient.entities.Notification.update(n.id, { is_handled: true });
    setNotifications(notifications.filter((x) => x.id !== n.id));
    toast({ title: "ההתראה טופלה בהצלחה" });
  };

  const sendReply = async () => {
    if (!replyMsg.trim() || !replyTo) return;
    const targetId = await resolveReplyTargetUserId(replyTo, {
      members,
      fetchAdmins: () => apiClient.entities.User.filter({ role: "admin" }),
    });
    if (!targetId) {
      toast({ title: "שגיאה", description: "לא ניתן לזהות את השולח", variant: "destructive" });
      return;
    }
    if (adminUserId != null && Number(targetId) === Number(adminUserId)) {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח הודעה לעצמך", variant: "destructive" });
      return;
    }
    try {
      await apiClient.entities.Notification.create({
        target_user_id: Number(targetId),
        title: "תשובה מהנהלה",
        body: replyMsg.trim(),
        type: "info",
        source: "הנהלה",
        source_user_id: adminUserId || undefined,
      });
      toast({
        title: "ההודעה נשלחה",
        description: `נשלחה ל${formatNotificationSender(replyTo, senderCtx)}`,
      });
      setReplyMsg("");
      setReplyTo(null);
    } catch (err) {
      console.error("[AdminAlerts] sendReply", err);
      toast({ title: "שגיאה", description: "שליחת ההודעה נכשלה", variant: "destructive" });
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  // Inbox for admin: only messages addressed TO the admin — never own outbound broadcasts.
  const activeAlerts = notifications.filter(
    (n) =>
      !n.is_handled &&
      adminUserId != null &&
      Number(n.target_user_id) === Number(adminUserId) &&
      !isAdminAuthored(n, adminUserId)
  );

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

      <div className="space-y-2">
        <h3 className="text-sm font-bold">הודעות נכנסות ({activeAlerts.length})</h3>
        {activeAlerts.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">אין הודעות נכנסות</p>
        )}
        {activeAlerts.map((n) => {
          const meta = alertTypeMeta[n.type] || alertTypeMeta.info;
          const Icon = meta.icon;
          const senderLabel = formatNotificationSender(n, senderCtx);
          return (
            <div key={n.id} className={`card-lux p-3 ${meta.bg}`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 ${meta.color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title || meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">שולח: {senderLabel}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_date).toLocaleDateString("he-IL")}</span>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{n.body}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setReplyTo(n)}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-primary/15 text-primary flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" /> שלח הודעה
                </button>
                <button onClick={() => markHandled(n)} className="flex-1 text-xs py-1.5 rounded-lg bg-green-500/15 text-green-500 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> סמן כטופל
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {replyTo && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setReplyTo(null)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">שלח הודעה ל{formatNotificationSender(replyTo, senderCtx)}</h3>
              <button type="button" onClick={() => setReplyTo(null)} className="p-2 rounded-lg bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={replyMsg}
              onChange={(e) => setReplyMsg(e.target.value)}
              placeholder="כתוב הודעה..."
              className="w-full bg-input rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setReplyTo(null)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">
                ביטול
              </button>
              <button type="button" onClick={sendReply} disabled={!replyMsg.trim()} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">
                שלח
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
