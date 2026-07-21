import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Lock, Flame, Zap, Check, Send, Edit2, CheckCheck } from "lucide-react";
import ProgressRing from "@/components/ProgressRing";
import { useToast } from "@/components/ui/use-toast";

const statusColor = {
  "בעקבות": "bg-green-500",
  "דרושה התייחסות": "bg-orange-400",
  קריטי: "bg-red-500",
  "לא פעיל": "bg-gray-500",
};

const PRIORITIES = ["דחוף", "בינוני", "נמוך"];

const NUDGE_TEMPLATES = [
  "הגיע הזמן לעדכן את גלגל המשימות שלך 🎯",
  "כל הכבוד על ההתקדמות! ממשיכים ללחוץ קדימה 💪",
  "איפה הכובש/ת שלי? חכה לך בליגה 🔥",
  "לא עוזבים את השטח — מה הסטטוס שלך?",
  "הקרב עוד לא נגמר, יש עוד משימות לכבוש ⚔️",
];

export default function ParticipantModal({ member, onClose, sourceName, onNudgeSent, readOnly = false }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("templates");
  const [customMsg, setCustomMsg] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    (async () => {
      if (!member?.goal_id) {
        setLoading(false);
        return;
      }
      try {
        const t = await base44.entities.Task.filter({ goal_id: member.goal_id });
        setTasks(t.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
      } finally {
        setLoading(false);
      }
    })();
  }, [member]);

  const sendNudge = (msg) => {
    base44.entities.Notification.create({
      target_user_id: member.user_id,
      title: sourceName ? "הודעה מהקבוצה" : "הודעה מהמנהל/ת",
      body: msg,
      type: "nudge",
      source: sourceName || "המנהל/ת שלך",
    });
    toast({ title: "הדחיפה נשלחה! 🚀", description: `אל ${member.name}` });
    if (onNudgeSent) onNudgeSent(member);
    onClose();
  };

  const updateTask = async (task, patch) => {
    const updated = await base44.entities.Task.update(task.id, patch);
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
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

  const hidden = member?.goal_hidden;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card/95 backdrop-blur p-4 flex items-center justify-between border-b border-border z-10">
          <h3 className="font-bold">פרטי משתתף</h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
        </div>

        {member && (
          <div className="p-4 space-y-4">
            {/* profile */}
            <div className="flex items-center gap-3">
              <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=1a1a1a&color=C5A880&bold=true`} alt={member.name} className="w-14 h-14 rounded-full ring-2 ring-primary/40" />
              <div className="flex-1">
                <h2 className="font-bold text-lg">{member.name}</h2>
                <p className="text-xs text-muted-foreground">{member.group_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${statusColor[member.status]}`} />
                  <span className="text-[10px] text-muted-foreground">{member.status}</span>
                </div>
              </div>
              <ProgressRing progress={member.progress || 0} size={48} stroke={4} showText />
            </div>

            {/* metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card-lux p-2 text-center">
                <Zap className="w-4 h-4 text-primary mx-auto" />
                <p className="font-bold text-sm mt-1">{member.xp}</p>
                <p className="text-[9px] text-muted-foreground">XP</p>
              </div>
              <div className="card-lux p-2 text-center">
                <Flame className="w-4 h-4 text-orange-400 mx-auto" />
                <p className="font-bold text-sm mt-1">{member.streak}</p>
                <p className="text-[9px] text-muted-foreground">רצף</p>
              </div>
              <div className="card-lux p-2 text-center">
                <span className="text-sm">{member.progress || 0}%</span>
                <p className="text-[9px] text-muted-foreground">התקדמות</p>
              </div>
            </div>

            {/* tasks — real data from member's goal, with edit + priority; blurred when hidden */}
            {hidden ? (
              <div className="relative">
                <div className="space-y-2 select-none" style={{ filter: "blur(8px)", pointerEvents: "none" }}>
                  {tasks.length === 0 ? (
                    <>
                      <div className="card-lux p-3 h-10" />
                      <div className="card-lux p-3 h-10" />
                      <div className="card-lux p-3 h-10" />
                    </>
                  ) : (
                    tasks.slice(0, 5).map((t) => (
                      <div key={t.id} className="card-lux p-2 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border border-muted-foreground/40" />
                        <span className="text-xs flex-1">{t.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{t.priority}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-background/80 backdrop-blur-sm px-4 py-3 rounded-xl">
                    <Lock className="w-7 h-7 text-primary/60 mx-auto mb-1" />
                    <p className="text-sm font-bold">יעד חסוי</p>
                    <p className="text-[11px] text-muted-foreground">אין גישה למנהל</p>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">רשימת משימות</p>
                {tasks.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">אין משימות</p>}
                {tasks.map((task) => (
                  <div key={task.id} className="card-lux p-2.5 flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${task.is_completed ? "gold-bg border-primary" : "border-muted-foreground/40"}`}>
                      {task.is_completed && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    </div>
                    {readOnly ? (
                      <span className={`text-xs flex-1 ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                    ) : editingId === task.id ? (
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(task)}
                        autoFocus
                        className="flex-1 bg-input rounded px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className={`text-xs flex-1 ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</span>
                    )}
                    {!readOnly && (
                      <>
                        {editingId === task.id ? (
                          <button onClick={() => saveEdit(task)} className="p-1 rounded text-primary"><CheckCheck className="w-4 h-4" /></button>
                        ) : (
                          <button onClick={() => startEdit(task)} className="p-1 rounded text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                        )}
                        <button
                          onClick={() => cyclePriority(task)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            task.priority === "דחוף" ? "bg-destructive/20 text-destructive" : task.priority === "בינוני" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {task.priority}
                        </button>
                      </>
                    )}
                    {readOnly && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        task.priority === "דחוף" ? "bg-destructive/20 text-destructive" : task.priority === "בינוני" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* nudge system */}
            <div className="card-gold-rim p-3 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setTab("templates")} className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "templates" ? "gold-bg text-black font-bold" : "bg-muted"}`}>תבניות</button>
                <button onClick={() => setTab("custom")} className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "custom" ? "gold-bg text-black font-bold" : "bg-muted"}`}>הודעה אישית</button>
              </div>
              {tab === "templates" ? (
                <div className="space-y-1.5">
                  {NUDGE_TEMPLATES.map((t) => (
                    <button key={t} onClick={() => sendNudge(t)} className="w-full text-right text-xs p-2.5 rounded-lg bg-muted hover:bg-accent">{t}</button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea value={customMsg} onChange={(e) => setCustomMsg(e.target.value)} placeholder="כתוב הודעה..." className="w-full bg-input rounded-lg p-2.5 text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => customMsg.trim() && sendNudge(customMsg)} className="w-full gold-bg text-black rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-2"><Send className="w-4 h-4" /> שלח דחיפה</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}