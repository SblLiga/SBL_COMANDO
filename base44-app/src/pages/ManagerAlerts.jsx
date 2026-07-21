import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCircle2, AlertCircle, Info, Flame, Zap, FileText, Send, X, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";
import ParticipantModal from "@/components/ParticipantModal";

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "manager_msg", label: "הודעה ממנהל" },
  { id: "inactive", label: "לא עודכנו נתונים" },
  { id: "missing_report", label: "דוח חסר" },
];

function getNotifType(n) {
  if (n.type === "nudge" && n.source && n.source !== "המערכת") return "manager_msg";
  if (n.type === "warning" && n.body && n.body.includes("ימים")) return "inactive";
  if (n.type === "info" && n.title && n.title.includes("דוח")) return "missing_report";
  if (n.type === "info" && n.source && n.source !== "המערכת" && n.source !== "אוטומציה") return "manager_msg";
  return "system";
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyMsg, setReplyMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const n = await base44.entities.Notification.filter({ target_user_id: user.id });
        setNotifications(n.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markRead = async (n) => {
    if (n.is_read) return;
    const updated = await base44.entities.Notification.update(n.id, { is_read: true });
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
  };

  const markHandled = async (n) => {
    const updated = await base44.entities.Notification.update(n.id, { is_read: true, is_handled: true });
    setNotifications((prev) => {
      const updated_list = prev.map((x) => (x.id === n.id ? updated : x));
      // Move handled items to end
      return [...updated_list.filter((x) => !x.is_handled || x.id !== n.id), updated];
    });
    toast({ title: "סומן כטופל", description: "ההתראה טופלה בהצלחה" });
  };

  const sendReply = async () => {
    if (!replyMsg.trim() || !replyTo) return;
    await base44.entities.Notification.create({
      target_user_id: replyTo.target_user_id || replyTo.source_user_id,
      title: "הודעה ממנהל",
      body: replyMsg.trim(),
      type: "nudge",
      source: "המנהל/ת שלך",
    });
    toast({ title: "ההודעה נשלחה", description: `ל${replyTo.source}` });
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
  // Sort: unread/handled=false first
  const sorted = [...filtered].sort((a, b) => (a.is_handled === b.is_handled ? 0 : a.is_handled ? 1 : -1));

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור מנהל" title="הודעות והתראות" subtitle={`${notifications.filter((n) => !n.is_read).length} חדשות`} />

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
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
              onClick={() => markRead(n)}
              className={`w-full text-right card-lux p-3 space-y-2 ${n.is_handled ? "opacity-50" : n.is_read ? "" : "ring-1 ring-primary/30"}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${cat.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{cat.label}</span>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-sm font-bold truncate mt-0.5">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                  {n.source && <p className="text-[10px] text-primary/70 mt-1">— {n.source}</p>}
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-border">
                {n._cat === "inactive" && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected({ name: n.title.replace(" - לא פעיל", ""), user_id: n.target_user_id, goal_id: null, goal_hidden: false }); }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                    >
                      פרטים
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected({ name: n.title.replace(" - לא פעיל", ""), user_id: n.target_user_id, goal_id: null, goal_hidden: false }); }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-primary/15 text-primary flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> דחיפה
                    </button>
                  </>
                )}
                {n._cat === "manager_msg" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReplyTo(n); }}
                    className="text-[10px] px-2 py-1 rounded-lg bg-primary/15 text-primary flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> שלח הודעה
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); markHandled(n); }}
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

      {/* Reply modal */}
      {replyTo && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setReplyTo(null)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">שלח הודעה ל{replyTo.source}</h3>
              <button onClick={() => setReplyTo(null)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={replyMsg}
              onChange={(e) => setReplyMsg(e.target.value)}
              placeholder="כתוב הודעה..."
              className="w-full bg-input rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button onClick={() => setReplyTo(null)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">ביטול</button>
              <button onClick={sendReply} disabled={!replyMsg.trim()} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">שלח</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ParticipantModal member={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}