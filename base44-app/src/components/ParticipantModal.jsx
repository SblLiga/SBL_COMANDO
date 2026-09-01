import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { X, Lock, Flame, Zap, Check, Send, Edit2, CheckCheck, Gift } from "lucide-react";
import ProgressRing from "@/components/ProgressRing";
import { useToast } from "@/components/ui/use-toast";
import UserAvatar from "@/components/UserAvatar";
import { mediaUrl } from "@/lib/mediaUrl";

const statusColor = {
  "בעקבות": "bg-green-500",
  "דרושה התייחסות": "bg-orange-400",
  קריטי: "bg-red-500",
  "לא פעיל": "bg-gray-500",
};

const PRIORITIES = ["דחוף", "בינוני", "נמוך"];

const NUDGE_TEMPLATES = [
  "זמן לעדכן את גלגל המשימות שלך",
  "מתכוננים לישיבה השבועית הקרובה",
  "שמתי לב שלא עודכנה התקדמות השבוע",
  "כל הכבוד על ההתקדמות! ממשיכים קדימה",
];

export default function ParticipantModal({
  member,
  onClose,
  sourceName,
  sourceUserId,
  onNudgeSent,
  readOnly = false,
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState("templates");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [goalDesc, setGoalDesc] = useState(member?.goal_title || "");
  const [rewardText, setRewardText] = useState("");
  const [rewardImage, setRewardImage] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setGoalDesc(member?.goal_title || "");
    setRewardText("");
    setRewardImage("");
    (async () => {
      if (!member?.goal_id) {
        setLoading(false);
        return;
      }
      try {
        const t = await apiClient.entities.Task.filter({ goal_id: member.goal_id });
        setTasks(t.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
        try {
          const g = await apiClient.entities.Goal.get(member.goal_id);
          if (g?.title) setGoalDesc(g.title);
          setRewardText(g?.reward_text || "");
          setRewardImage(g?.reward_image || "");
        } catch {
          /* ignore */
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [member]);

  const sendNudge = async () => {
    const msg = tab === "templates" ? selectedTemplate : customMsg.trim();
    if (!msg || !member?.user_id || sending) return;
    setSending(true);
    try {
      await apiClient.entities.Notification.create({
        target_user_id: member.user_id,
        title: sourceName ? "הודעה מהקבוצה" : "הודעה מהמנהל/ת",
        body: msg,
        type: "nudge",
        source: sourceName || "המנהל/ת שלך",
        source_user_id: sourceUserId || undefined,
      });
      toast({ title: "הדחיפה נשלחה", description: `הודעה נשלחה ל${member.name}` });
      onNudgeSent?.(member);
      onClose();
    } catch (err) {
      console.error("[ParticipantModal] nudge", err);
      toast({ title: "שגיאה", description: "שליחת הדחיפה נכשלה", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const updateTask = async (task, patch) => {
    const updated = await apiClient.entities.Task.update(task.id, patch);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const cyclePriority = (task) => {
    const next = PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
    updateTask(task, { priority: next });
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditText(task.title);
  };

  const saveEdit = async (task) => {
    if (!editText.trim()) return;
    await updateTask(task, { title: editText.trim() });
    setEditingId(null);
    toast({ title: "המשימה עודכנה ✓" });
  };

  const saveGoalDesc = async () => {
    if (!member?.goal_id || !goalDesc.trim()) return;
    await apiClient.entities.Goal.update(member.goal_id, { title: goalDesc.trim() });
    await apiClient.entities.Member.update(member.id, { goal_title: goalDesc.trim() });
    setEditingGoal(false);
    toast({ title: "היעד עודכן", description: "תיאור היעד נשמר בהצלחה" });
  };

  const hidden = member?.goal_hidden;
  const canSendNudge = tab === "templates" ? Boolean(selectedTemplate) : Boolean(customMsg.trim());
  // Push is always available when there is a recipient — independent of readOnly / goal_hidden.
  const showNudge = Boolean(member?.user_id);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card/95 backdrop-blur p-4 flex items-center justify-between border-b border-border z-10">
            <div className="flex items-center gap-3 min-w-0">
            <UserAvatar src={member?.avatar_url} name={member?.name || "?"} className="w-10 h-10 ring-2 ring-primary/40" />
            <div className="min-w-0">
              <h3 className="font-bold truncate">{member?.name}</h3>
              <p className="text-[10px] text-muted-foreground truncate">
                {hidden ? "יעד חסוי" : goalDesc || "יעד"} · {member?.xp || 0} XP
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg bg-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>

        {member && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="card-lux p-2 text-center">
                <ProgressRing progress={member.progress || 0} size={36} stroke={3} showText />
                <p className="text-[9px] text-muted-foreground mt-1">ביצוע</p>
              </div>
              <div className="card-lux p-2 text-center">
                <span className={`inline-block w-2 h-2 rounded-full ${statusColor[member.status] || "bg-gray-500"}`} />
                <p className="text-[9px] text-muted-foreground mt-1">{member.status}</p>
              </div>
              <div className="card-lux p-2 text-center">
                <Zap className="w-4 h-4 text-primary mx-auto" />
                <p className="font-bold text-sm mt-1">{member.xp || 0}</p>
                <p className="text-[9px] text-muted-foreground">XP</p>
              </div>
              <div className="card-lux p-2 text-center">
                <Flame className="w-4 h-4 text-orange-400 mx-auto" />
                <p className="font-bold text-sm mt-1">{member.streak || 0}</p>
                <p className="text-[9px] text-muted-foreground">רצף</p>
              </div>
            </div>

            {hidden ? (
              <div className="relative">
                <div className="space-y-2 select-none" style={{ filter: "blur(8px)", pointerEvents: "none" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card-lux p-3 h-10" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-background/80 backdrop-blur-sm px-4 py-3 rounded-xl">
                    <Lock className="w-7 h-7 text-primary/60 mx-auto mb-1" />
                    <p className="text-sm font-bold">יעד חסוי</p>
                    <p className="text-[10px] text-muted-foreground mt-1">היעד האישי מוסתר</p>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="card-lux p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] text-muted-foreground">יעד חודשי ראשי</p>
                    {!readOnly && (
                      <button type="button" onClick={() => (editingGoal ? saveGoalDesc() : setEditingGoal(true))} className="p-1 text-muted-foreground hover:text-primary">
                        {editingGoal ? <CheckCheck className="w-4 h-4" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {editingGoal ? (
                    <input
                      value={goalDesc}
                      onChange={(e) => setGoalDesc(e.target.value)}
                      className="w-full bg-input rounded-lg px-2 py-1.5 text-sm"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm font-bold">{goalDesc || "—"}</p>
                  )}
                </div>

                {(rewardText || rewardImage) && (
                  <div className="card-gold-rim p-3 space-y-2">
                    <p className="text-[10px] text-primary font-bold flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" /> תמריץ / תגמול
                    </p>
                    {rewardText ? <p className="text-sm">{rewardText}</p> : null}
                    {rewardImage ? (
                      <img
                        src={mediaUrl(rewardImage)}
                        alt="תמריץ"
                        className="w-full max-h-44 object-cover rounded-xl ring-1 ring-primary/30"
                      />
                    ) : null}
                  </div>
                )}

                <p className="text-xs font-bold text-muted-foreground">רשימת משימות</p>
                {tasks.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">אין משימות</p>}
                {tasks.map((task) => (
                  <div key={task.id} className="card-lux p-2.5 flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${task.is_completed ? "gold-bg border-primary" : "border-muted-foreground/40"}`}>
                      {task.is_completed && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    </div>
                    {readOnly || editingId !== task.id ? (
                      <span className={`text-xs flex-1 ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                    ) : (
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(task)}
                        autoFocus
                        className="flex-1 bg-input rounded px-2 py-1 text-xs"
                      />
                    )}
                    {!readOnly && (
                      <>
                        {editingId === task.id ? (
                          <button type="button" onClick={() => saveEdit(task)} className="p-1 rounded text-primary"><CheckCheck className="w-4 h-4" /></button>
                        ) : (
                          <button type="button" onClick={() => startEdit(task)} className="p-1 rounded text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                        )}
                        <button
                          type="button"
                          onClick={() => cyclePriority(task)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            task.priority === "דחוף" ? "bg-destructive/20 text-destructive" : task.priority === "בינוני" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {task.priority}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showNudge && (
              <div className="card-gold-rim p-3 space-y-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTab("templates")} className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "templates" ? "gold-bg text-black font-bold" : "bg-muted"}`}>תבניות מוכנות</button>
                  <button type="button" onClick={() => setTab("custom")} className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "custom" ? "gold-bg text-black font-bold" : "bg-muted"}`}>הודעה חופשית</button>
                </div>
                {tab === "templates" ? (
                  <div className="space-y-1.5">
                    {NUDGE_TEMPLATES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTemplate(t)}
                        className={`w-full text-right text-xs p-2.5 rounded-lg ${selectedTemplate === t ? "gold-bg text-black" : "bg-muted hover:bg-accent"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="כתבי הודעה מותאמת אישית..."
                    className="w-full bg-input rounded-lg p-2.5 text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 bg-muted rounded-lg py-2 text-sm font-medium">ביטול</button>
                  <button
                    type="button"
                    onClick={sendNudge}
                    disabled={!canSendNudge || sending}
                    className="flex-1 gold-bg text-black rounded-lg py-2 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {sending ? "שולח..." : "שליחת דחיפה"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
