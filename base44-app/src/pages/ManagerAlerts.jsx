import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Bell, AlertCircle, Info, Zap, FileText, Send, X, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";
import ParticipantModal from "@/components/ParticipantModal";
import NudgeModal from "@/components/NudgeModal";

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "manager_msg", label: "הודעה ממנהל" },
  { id: "inactive", label: "לא עודכנו נתונים" },
  { id: "missing_report", label: "דוח חסר" },
];

function getNotifType(n) {
  if (n.type === "nudge" && n.source && n.source !== "המערכת") return "manager_msg";
  if (n.type === "warning" && n.body && (n.body.includes("ימים") || n.title?.includes("לא פעיל"))) return "inactive";
  if (n.type === "info" && n.title && n.title.includes("דוח")) return "missing_report";
  if (n.type === "info" && n.source && n.source !== "המערכת" && n.source !== "אוטומציה") return "manager_msg";
  return "system";
}

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
}

const typeStyle = {
  manager_msg: { icon: Bell, color: "text-blue-400", label: "הודעה ממנהל" },
  inactive: { icon: AlertCircle, color: "text-orange-400", label: "לא עודכנו נתונים" },
  missing_report: { icon: FileText, color: "text-red-400", label: "דוח חסר" },
  system: { icon: Info, color: "text-primary", label: "מערכת" },
};

export default function ManagerAlerts() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [nudgeTarget, setNudgeTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyMsg, setReplyMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        setCurrentUserId(user.id);
        setCurrentName(user.full_name || "");
        const [n, m] = await Promise.all([
          apiClient.entities.Notification.filter({ target_user_id: user.id }),
          apiClient.entities.Member.list(),
        ]);
        setNotifications(n.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
        setMembers(m);
        const me = m.find((x) => x.user_id === user.id);
        if (me?.name) setCurrentName(me.name);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resolveInactiveMember = (n) =>
    members.find((m) => m.name === n.title.replace(" - לא פעיל", "")) ||
    members.find((m) => n.body?.includes(m.name));

  const markRead = async (n) => {
    if (n.is_read) return;
    const updated = await apiClient.entities.Notification.update(n.id, { is_read: true });
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
  };

  const markHandled = async (n) => {
    const updated = await apiClient.entities.Notification.update(n.id, { is_read: true, is_handled: true });
    setNotifications((prev) => {
      const updated_list = prev.map((x) => (x.id === n.id ? updated : x));
      return [...updated_list.filter((x) => !x.is_handled), ...updated_list.filter((x) => x.is_handled)];
    });
    setDetail(null);
    toast({ title: "סומן כטופל", description: "ההתראה טופלה בהצלחה" });
  };

  const dismiss = async (n, event) => {
    event?.stopPropagation();
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await apiClient.entities.Notification.delete(n.id);
    } catch (err) {
      console.error("[ManagerAlerts] dismiss failed", err);
      apiClient.entities.Notification.update(n.id, { is_read: true }).catch(() => {});
    }
  };

  const openCard = async (n) => {
    await markRead(n);
    if (n._cat === "manager_msg") setDetail(n);
  };

  const sendReply = async () => {
    if (!replyMsg.trim() || !replyTo) return;
    const targetId = replyTo.source_user_id;
    if (!targetId) {
      toast({ title: "שגיאה", description: "לא ניתן לזהות את השולח", variant: "destructive" });
      return;
    }
    await apiClient.entities.Notification.create({
      target_user_id: targetId,
      title: "הודעה ממנהל",
      body: replyMsg.trim(),
      type: "info",
      source: currentName || "מנהל/ת",
      source_user_id: currentUserId,
    });
    toast({ title: "ההודעה נשלחה", description: `ההודעה נשלחה ל${replyTo.source}` });
    setReplyMsg("");
    setReplyTo(null);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const typed = notifications.map((n) => ({ ...n, _cat: getNotifType(n) }));
  const filtered = filter === "all" ? typed : typed.filter((n) => n._cat === filter);
  const sorted = [...filtered].sort((a, b) => (a.is_handled === b.is_handled ? 0 : a.is_handled ? 1 : -1));

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור מנהל" title="הודעות והתראות" subtitle={`${notifications.filter((n) => !n.is_read).length} חדשות`} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
              filter === f.id ? "gold-bg text-black" : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((n) => {
          const cat = typeStyle[n._cat] || typeStyle.system;
          const Icon = cat.icon;
          return (
            <div
              key={n.id}
              onClick={() => openCard(n)}
              className={`w-full text-right card-lux p-3 space-y-2 cursor-pointer ${n.is_handled ? "opacity-50" : n.is_read ? "" : "ring-1 ring-primary/30"}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${cat.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{cat.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-muted-foreground">{formatWhen(n.created_date || n.created_at)}</span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                      <button type="button" onClick={(e) => dismiss(n, e)} className="p-1 rounded-md hover:bg-muted" aria-label="סגור התראה">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold truncate mt-0.5">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                  {n.source && (
                    <p className="text-[10px] text-primary/70 mt-1">
                      שולח: {n.source} · {n.is_read ? "נקראה" : "חדשה"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-border">
                {n._cat === "inactive" && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(resolveInactiveMember(n) || { name: n.title.replace(" - לא פעיל", ""), goal_hidden: false });
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                    >
                      פרטים
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNudgeTarget(resolveInactiveMember(n) || { name: n.title.replace(" - לא פעיל", "") });
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-primary/15 text-primary flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> דחיפה
                    </button>
                  </>
                )}
                {n._cat === "manager_msg" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyTo(n);
                    }}
                    className="text-[10px] px-2 py-1 rounded-lg bg-primary/15 text-primary flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> שלח הודעה
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    markHandled(n);
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-green-500/15 text-green-500 flex items-center gap-1 mr-auto"
                >
                  <Check className="w-3 h-3" /> טופל
                </button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">אין הודעות והתראות להצגה</p>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">הודעה ממנהל</h3>
              <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-lg bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">שולח: {detail.source}</p>
            <p className="text-sm leading-relaxed">{detail.body}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatWhen(detail.created_date)} · {detail.is_read ? "נקראה" : "חדשה"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(detail);
                  setDetail(null);
                }}
                className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold"
              >
                שלח הודעה
              </button>
              <button type="button" onClick={() => markHandled(detail)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">
                טופל
              </button>
            </div>
          </div>
        </div>
      )}

      {replyTo && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setReplyTo(null)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">שלח הודעה ל{replyTo.source}</h3>
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

      {selected && (
        <ParticipantModal member={selected} onClose={() => setSelected(null)} sourceName={currentName} sourceUserId={currentUserId} />
      )}
      {nudgeTarget && (
        <NudgeModal member={nudgeTarget} sourceName={currentName} sourceUserId={currentUserId} onClose={() => setNudgeTarget(null)} />
      )}
    </div>
  );
}
