import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, CheckCircle2, AlertCircle, Info, Flame, Send, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
  const [showCompose, setShowCompose] = useState(false);
  const [composeTarget, setComposeTarget] = useState("manager");
  const [composeMsg, setComposeMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const myMembers = await base44.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setCurrentMember(me);

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
    setNotifications(notifications.map((x) => (x.id === n.id ? updated : x)));
  };

  const sendCompose = async () => {
    if (!composeMsg.trim() || !currentMember) return;
    setSending(true);
    try {
      if (composeTarget === "group") {
        const groupMembers = await base44.entities.Member.filter({ group_id: currentMember.group_id });
        const targets = groupMembers.filter((m) => m.user_id && m.user_id !== currentMember.user_id);
        await base44.entities.Notification.bulkCreate(
          targets.map((m) => ({
            target_user_id: m.user_id,
            title: "הודעה מהקבוצה",
            body: composeMsg.trim(),
            type: "info",
            source: currentMember.name,
          }))
        );
        toast({ title: "ההודעה נשלחה 📨", description: `לכל חברי הקבוצה (${targets.length})` });
      } else if (composeTarget === "manager") {
        // Find the group's manager
        const groups = await base44.entities.Group.list();
        const myGroup = groups.find((g) => g.id === currentMember.group_id);
        if (myGroup?.manager_id) {
          const mgrMembers = await base44.entities.Member.filter({ user_id: myGroup.manager_id });
          const mgr = mgrMembers[0];
          if (mgr?.user_id) {
            await base44.entities.Notification.create({
              target_user_id: mgr.user_id,
              title: "הודעה ממשתתף/ת",
              body: composeMsg.trim(),
              type: "info",
              source: currentMember.name,
            });
            toast({ title: "ההודעה נשלחה 📨", description: `ל${mgr.name}` });
          } else {
            toast({ title: "שגיאה", description: "לא נמצא מנהל/ת לקבוצה", variant: "destructive" });
          }
        }
      } else if (composeTarget === "admin") {
        const admins = await base44.entities.Member.filter({ role: "admin" });
        const targets = admins.filter((a) => a.user_id);
        if (targets.length > 0) {
          await base44.entities.Notification.bulkCreate(
            targets.map((a) => ({
              target_user_id: a.user_id,
              title: "הודעה ממשתמש/ת",
              body: composeMsg.trim(),
              type: "info",
              source: currentMember.name,
            }))
          );
          toast({ title: "ההודעה נשלחה 📨", description: `לאדמין (${targets.length})` });
        } else {
          toast({ title: "שגיאה", description: "לא נמצא אדמין", variant: "destructive" });
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

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="p-4 space-y-4 pb-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">תיבת השטח</h1>
          <p className="text-sm text-muted-foreground">{unread} הודעות חדשות</p>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-primary" />
          {unread > 0 && (
            <span className="absolute -top-1 -left-1 bg-destructive text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </div>

      {/* Compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
      >
        <Send className="w-4 h-4" /> שלח הודעה
      </button>

      <div className="space-y-2">
        {notifications.map((n) => {
          const st = typeStyle[n.type] || typeStyle.info;
          const Icon = st.icon;
          return (
            <button
              key={n.id}
              onClick={() => markRead(n)}
              className={`w-full text-right card-lux p-3 flex items-start gap-3 ring-1 ${n.is_read ? "ring-transparent opacity-70" : st.ring}`}
            >
              <Icon className={`w-5 h-5 ${st.color} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold truncate">{n.title}</p>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                {n.source && <p className="text-[10px] text-primary/70 mt-1">— {n.source}</p>}
              </div>
            </button>
          );
        })}
        {notifications.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">אין הודעות עדיין</p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowCompose(false)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> שלח הודעה</h3>
              <button onClick={() => setShowCompose(false)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setComposeTarget("manager")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "manager" ? "gold-bg text-black" : "bg-muted"}`}>למנהל/ת</button>
              <button onClick={() => setComposeTarget("admin")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "admin" ? "gold-bg text-black" : "bg-muted"}`}>לאדמין</button>
              <button onClick={() => setComposeTarget("group")} className={`flex-1 text-xs py-2 rounded-lg font-medium ${composeTarget === "group" ? "gold-bg text-black" : "bg-muted"}`}>לקבוצה</button>
            </div>
            <textarea
              value={composeMsg}
              onChange={(e) => setComposeMsg(e.target.value)}
              placeholder="כתוב/י הודעה..."
              className="w-full bg-input rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCompose(false)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">ביטול</button>
              <button onClick={sendCompose} disabled={!composeMsg.trim() || sending} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">
                {sending ? "שולח..." : "שלח"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}