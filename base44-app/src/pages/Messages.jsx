import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Bell, CheckCircle2, AlertCircle, Info, Flame, Send, X, Reply, CheckCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "tasks", label: "עמידה במשימות" },
  { id: "manager", label: "מנהל / אדמין" },
  { id: "inactive", label: "חוסר פעילות" },
];

function getMsgCategory(n) {
  if (n.type === "warning" || (n.body && n.body.includes("ימים") && n.title?.includes("פעיל"))) return "inactive";
  if (n.type === "nudge") return "manager";
  if (n.source && !["המערכת", "אוטומציה", "system"].includes(n.source)) return "manager";
  if (n.type === "success" || n.title?.includes("משימ") || n.body?.includes("משימ")) return "tasks";
  return "tasks";
}

const typeStyle = {
  success: { icon: CheckCircle2, color: "text-green-500", ring: "ring-green-500/20" },
  danger: { icon: AlertCircle, color: "text-red-500", ring: "ring-red-500/20" },
  warning: { icon: AlertCircle, color: "text-orange-400", ring: "ring-orange-400/20" },
  info: { icon: Info, color: "text-primary", ring: "ring-primary/20" },
  nudge: { icon: Flame, color: "text-primary", ring: "ring-primary/20" },
};

export default function Messages() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCompose, setShowCompose] = useState(false);
  const [composeTarget, setComposeTarget] = useState("manager");
  const [composeMsg, setComposeMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setCurrentMember(me);

        const n = await apiClient.entities.Notification.filter({ target_user_id: user.id });
        const sorted = n.sort(
          (a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at)
        );
        // Deduplicate: remove notifications with same title+body+source within 60 seconds
        const deduped = sorted.filter((item, i, arr) => {
          if (i === 0) return true;
          const prev = arr[i - 1];
          const timeDiff = Math.abs(
            new Date(prev.created_date || prev.created_at) - new Date(item.created_date || item.created_at)
          );
          return !(
            item.title === prev.title &&
            item.body === prev.body &&
            item.source === prev.source &&
            timeDiff < 60000
          );
        });
        setNotifications(deduped);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markRead = async (n) => {
    if (n.is_read) return;
    const updated = await apiClient.entities.Notification.update(n.id, { is_read: true });
    setNotifications(notifications.map((x) => (x.id === n.id ? updated : x)));
  };

  const markAllRead = async () => {
    const unreadItems = notifications.filter((n) => !n.is_read);
    if (unreadItems.length === 0) return;
    try {
      await apiClient.entities.Notification.bulkUpdate(unreadItems.map((n) => ({ id: n.id, is_read: true })));
    } catch {
      await Promise.all(unreadItems.map((n) => apiClient.entities.Notification.update(n.id, { is_read: true })));
    }
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    toast({ title: "כל ההודעות סומנו כנקראו ✓" });
  };

  const dismiss = async (n, event) => {
    event?.stopPropagation();
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await apiClient.entities.Notification.delete(n.id);
    } catch (err) {
      console.error("[Messages] dismiss failed", err);
      apiClient.entities.Notification.update(n.id, { is_read: true }).catch(() => {});
    }
  };

  const sendBulkWithFallback = async (payload) => {
    try {
      await apiClient.entities.Notification.bulkCreate(payload);
    } catch {
      await Promise.all(payload.map((p) => apiClient.entities.Notification.create(p)));
    }
  };

  const sendReply = async (n) => {
    if (!replyText.trim() || !currentMember) return;
    try {
      let targetUserId = n.source_user_id;
      if (!targetUserId && n.source) {
        const allMembers = await apiClient.entities.Member.list();
        const sender = allMembers.find((m) => m.name === n.source);
        targetUserId = sender?.user_id;
      }
      if (targetUserId) {
        await apiClient.entities.Notification.create({
          target_user_id: targetUserId,
          title: "תגובה על הודעה",
          body: replyText.trim(),
          type: "info",
          source: currentMember?.name || "משתמש",
          source_user_id: currentMember.user_id,
        });
        toast({ title: "התגובה נשלחה 📨" });
        setReplyingTo(null);
        setReplyText("");
      } else {
        toast({ title: "שגיאה", description: "לא ניתן למצוא את השולח", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "שגיאה", description: "שליחת התגובה נכשלה", variant: "destructive" });
    }
  };

  const sendCompose = async () => {
    if (!composeMsg.trim() || !currentMember) return;
    setSending(true);
    try {
      const sourceName = currentMember.name || "משתמש";
      if (composeTarget === "group") {
        const groupMembers = await apiClient.entities.Member.filter({ group_id: currentMember.group_id });
        const targets = groupMembers.filter((m) => m.user_id && m.user_id !== currentMember.user_id);
        if (targets.length === 0) {
          toast({ title: "אין נמענים", description: "אין חברים נוספים בקבוצה" });
        } else {
          await sendBulkWithFallback(
            targets.map((m) => ({
              target_user_id: m.user_id,
              title: "הודעה מהקבוצה",
              body: composeMsg.trim(),
              type: "info",
              source: sourceName,
              source_user_id: currentMember.user_id,
            }))
          );
          toast({ title: "ההודעה נשלחה 📨", description: `לכל חברי הקבוצה (${targets.length})` });
        }
      } else if (composeTarget === "manager") {
        const groups = await apiClient.entities.Group.list();
        const myGroup = groups.find((g) => String(g.id) === String(currentMember.group_id));
        let mgr = null;
        if (myGroup?.manager_id) {
          const byId = await apiClient.entities.Member.filter({ id: myGroup.manager_id }).catch(() => []);
          mgr = byId[0];
          if (!mgr) {
            const byUser = await apiClient.entities.Member.filter({ user_id: myGroup.manager_id });
            mgr = byUser[0];
          }
        }
        if (!mgr && myGroup?.manager_name) {
          const all = await apiClient.entities.Member.filter({ role: "manager" });
          mgr = all.find((m) => m.name === myGroup.manager_name);
        }
        if (mgr?.user_id) {
          await apiClient.entities.Notification.create({
            target_user_id: mgr.user_id,
            title: "הודעה ממשתתף/ת",
            body: composeMsg.trim(),
            type: "info",
            source: sourceName,
            source_user_id: currentMember.user_id,
          });
          toast({ title: "ההודעה נשלחה 📨", description: `ל${mgr.name}` });
        } else {
          toast({ title: "שגיאה", description: "לא נמצא מנהל/ת לקבוצה", variant: "destructive" });
        }
      } else if (composeTarget === "admin") {
        const admins = await apiClient.entities.User.filter({ role: "admin" });
        const targets = (admins || []).filter((a) => a.id);
        if (targets.length === 0) {
          toast({ title: "שגיאה", description: "לא נמצא אדמין", variant: "destructive" });
        } else {
          await sendBulkWithFallback(
            targets.map((a) => ({
              target_user_id: a.id,
              title: "הודעה ממשתמש/ת",
              body: composeMsg.trim(),
              type: "info",
              source: sourceName,
              source_user_id: currentMember.user_id,
            }))
          );
          toast({ title: "ההודעה נשלחה 📨", description: `לאדמין (${targets.length})` });
        }
      }
      setComposeMsg("");
      setShowCompose(false);
    } catch (err) {
      toast({ title: "שגיאה", description: "שליחת ההודעה נכשלה", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const typed = notifications.map((n) => ({ ...n, _cat: getMsgCategory(n) }));
  const filtered = filter === "all" ? typed : typed.filter((n) => n._cat === filter);
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="p-4 space-y-4 pb-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">הודעות</p>
          <h1 className="font-display text-2xl font-bold">תיבת השטח</h1>
          <p className="text-sm text-muted-foreground">{unread} הודעות חדשות</p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs bg-muted hover:bg-accent rounded-lg px-3 py-2 font-medium transition-colors"
            >
              <CheckCheck className="w-4 h-4 text-primary" />
              סמן הכל כנקרא
            </button>
          )}
          <div className="relative">
            <Bell className="w-6 h-6 text-primary" />
            {unread > 0 && (
              <span className="absolute -top-1 -left-1 bg-destructive text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowCompose(true)}
        className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
      >
        <Send className="w-4 h-4" /> שלח הודעה
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium ${
              filter === f.id ? "gold-bg text-black" : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((n) => {
          const st = typeStyle[n.type] || typeStyle.info;
          const Icon = st.icon;
          return (
            <div
              key={n.id}
              className={`w-full text-right card-lux p-3 flex items-start gap-3 ring-1 ${n.is_read ? "ring-transparent opacity-70" : st.ring}`}
            >
              <Icon className={`w-5 h-5 ${st.color} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold truncate">{n.title}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    <button
                      type="button"
                      onClick={(e) => dismiss(n, e)}
                      className="p-1 rounded-md hover:bg-muted/80 transition-colors"
                      aria-label="סגור הודעה"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                {n.source && <p className="text-[10px] text-primary/70 mt-1">— {n.source}</p>}

                <div className="flex items-center gap-2 mt-2">
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => markRead(n)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted hover:bg-accent font-medium transition-colors"
                    >
                      <CheckCheck className="w-3 h-3 text-primary" />
                      סמן כנקרא
                    </button>
                  )}
                  {(n.source || n.source_user_id) && n.type !== "nudge" && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(replyingTo === n.id ? null : n.id);
                        setReplyText("");
                      }}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted hover:bg-accent font-medium transition-colors"
                    >
                      <Reply className="w-3 h-3 text-primary" />
                      השב
                    </button>
                  )}
                </div>

                {replyingTo === n.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="כתוב/י תגובה..."
                      className="w-full bg-input rounded-lg p-2 text-xs h-16 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                        className="flex-1 bg-muted rounded-lg py-1.5 text-xs font-medium"
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => sendReply(n)}
                        disabled={!replyText.trim()}
                        className="flex-1 gold-bg text-black rounded-lg py-1.5 text-xs font-bold disabled:opacity-40"
                      >
                        שלח תגובה
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">אין הודעות והתראות להצגה</p>
          </div>
        )}
      </div>

      {showCompose && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowCompose(false)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> שלח הודעה</h3>
              <button type="button" onClick={() => setShowCompose(false)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setComposeTarget("manager")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "manager" ? "gold-bg text-black" : "bg-muted"}`}>למנהל/ת</button>
              <button type="button" onClick={() => setComposeTarget("admin")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "admin" ? "gold-bg text-black" : "bg-muted"}`}>לאדמין</button>
              <button type="button" onClick={() => setComposeTarget("group")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "group" ? "gold-bg text-black" : "bg-muted"}`}>לקבוצה</button>
            </div>
            <textarea
              value={composeMsg}
              onChange={(e) => setComposeMsg(e.target.value)}
              placeholder="כתוב/י הודעה..."
              className="w-full bg-input rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCompose(false)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">ביטול</button>
              <button type="button" onClick={sendCompose} disabled={!composeMsg.trim() || sending} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">
                {sending ? "שולח..." : "שלח"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
