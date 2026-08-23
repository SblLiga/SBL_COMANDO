import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Zap, Flame, Plus, Check, EyeOff, Eye, GripVertical, Pencil, Trash2, Gift, Users, Upload, Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SmartWheel from "@/components/SmartWheel";
import KpiCard from "@/components/KpiCard";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { ensureMyGoal } from "@/lib/myGoal";
import { mediaUrl } from "@/lib/mediaUrl";
import { prepareImageForUpload, formatUploadError } from "@/lib/prepareImageUpload";

export default function Goal() {
  const { pathname } = useLocation();
  const hideDomainSwap = pathname.startsWith("/admin");
  const { toast } = useToast();
  const [goal, setGoal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [xpPerTask, setXpPerTask] = useState(100);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [group, setGroup] = useState(null);
  const [uploadingReward, setUploadingReward] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { goal: g } = await ensureMyGoal(apiClient);
      setGoal(g);
      const t = await apiClient.entities.Task.filter({ goal_id: g.id });
      setTasks(t.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).slice(0, 9));
      try {
        const settings = await apiClient.entities.SystemSetting.list();
        if (settings[0]?.xp_task) setXpPerTask(settings[0].xp_task);
      } catch (err) {
        console.error("[Goal] Failed to load XP settings:", err);
      }
      try {
        const user = await apiClient.auth.me();
        setIsAdmin((user?.role || "").toLowerCase() === "admin");
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        if (myMembers[0]?.group_id) {
          const groups = await apiClient.entities.Group.list();
          setGroup(groups.find((grp) => grp.id === myMembers[0].group_id) || null);
        }
      } catch (err) {
        console.error("[Goal] Failed to load group:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadRewardImage = async (file) => {
    if (!file || !goal?.id) return;
    setUploadingReward(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const res = await apiClient.integrations.Core.UploadFile({ file: prepared, purpose: "reward" });
      const url = res?.file_url || res?.url;
      if (!url) throw new Error("השרת לא החזיר קישור");
      const g = await apiClient.entities.Goal.update(goal.id, { reward_image: url });
      setGoal(g);
      toast({ title: "תמונת התמריץ עודכנה", description: "התמונה תוצג גם למנהל/ת." });
    } catch (err) {
      toast({
        title: "העלאה נכשלה",
        description: formatUploadError(err),
        variant: "destructive",
      });
    } finally {
      setUploadingReward(false);
    }
  };

  const recalc = (taskList) => {
    const completed = taskList.filter((t) => t.is_completed).length;
    const pct = taskList.length ? Math.round((completed / taskList.length) * 100) : 0;
    const xp = taskList.filter((t) => t.is_completed).reduce((s, t) => s + (xpPerTask || t.xp_value || 100), 0);
    return { pct, xp };
  };

  const toggleTask = async (task) => {
    const updated = await apiClient.entities.Task.update(task.id, { is_completed: !task.is_completed });
    const newTasks = tasks.map((t) => (t.id === task.id ? updated : t));
    setTasks(newTasks);
    const { pct, xp } = recalc(newTasks);
    const g = await apiClient.entities.Goal.update(goal.id, { progress: pct, xp_total: xp });
    setGoal(g);
    // Sync the linked Member entity (dynamic data sync for leaderboard)
    try {
      const user = await apiClient.auth.me();
      const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
      if (myMembers[0]) {
        await apiClient.entities.Member.update(myMembers[0].id, { xp, progress: pct });
      }
    } catch (err) {
      console.error("[Goal] Member sync failed:", err);
      toast({ title: "שגיאת סנכרון", description: "עדכון הדירוג נכשל", variant: "destructive" });
    }
    if (!task.is_completed) {
      toast({ title: "כל הכבוד! 💪", description: `+${task.xp_value || 100} XP`, className: "bg-card border-primary" });
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    if (tasks.length >= 9) {
      toast({ title: "מקסימום 9 משימות", description: "הגלגל מוגבל ל-9 משימות בלבד", variant: "destructive" });
      return;
    }
    const t = await apiClient.entities.Task.create({
      goal_id: goal.id,
      title: newTaskTitle,
      order_index: tasks.length,
      is_completed: false,
      priority: "בינוני",
      xp_value: xpPerTask,
    });
    setTasks([...tasks, t]);
    setNewTaskTitle("");
    setShowAdd(false);
  };

  const toggleHidden = async (val) => {
    const g = await apiClient.entities.Goal.update(goal.id, { is_hidden: val });
    setGoal(g);
    try {
      const user = await apiClient.auth.me();
      const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
      const me = myMembers[0];
      if (me) {
        await apiClient.entities.Member.update(me.id, { goal_hidden: val });
      }
    } catch (err) {
      console.error("[Goal] Failed to sync member goal_hidden:", err);
    }
  };

  const swapTasks = async (i, j) => {
    if (i === j || i < 0 || j < 0 || i >= tasks.length || j >= tasks.length) return;
    const arr = [...tasks];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const reordered = arr.map((t, idx) => ({ ...t, order_index: idx }));
    setTasks(reordered);
    await apiClient.entities.Task.bulkUpdate(reordered.map((t) => ({ id: t.id, order_index: t.order_index })));
  };

  const reorder = async (taskId, newIndex) => {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1 || newIndex < 0 || newIndex >= tasks.length || idx === newIndex) return;
    const arr = [...tasks];
    const [item] = arr.splice(idx, 1);
    arr.splice(newIndex, 0, item);
    const reordered = arr.map((t, i) => ({ ...t, order_index: i }));
    setTasks(reordered);
    await apiClient.entities.Task.bulkUpdate(reordered.map((t) => ({ id: t.id, order_index: t.order_index })));
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEditTask = async (task) => {
    if (!editingTitle.trim()) return;
    const updated = await apiClient.entities.Task.update(task.id, { title: editingTitle.trim() });
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    setEditingTaskId(null);
    toast({ title: "המשימה עודכנה" });
  };

  const deleteTask = async (task) => {
    if (tasks.length <= 4) {
      toast({
        title: "לא ניתן למחוק",
        description: "נדרשות לפחות 4 משימות בגלגל",
        variant: "destructive",
      });
      return;
    }
    await apiClient.entities.Task.delete(task.id);
    const newTasks = tasks.filter((t) => t.id !== task.id).map((t, i) => ({ ...t, order_index: i }));
    setTasks(newTasks);
    await apiClient.entities.Task.bulkUpdate(newTasks.map((t) => ({ id: t.id, order_index: t.order_index })));
    const { pct, xp } = recalc(newTasks);
    const g = await apiClient.entities.Goal.update(goal.id, { progress: pct, xp_total: xp });
    setGoal(g);
    toast({ title: "המשימה נמחקה" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!goal) return null;

  const pct = goal.progress || 0;

  return (
    <div className="p-4 space-y-5 pb-4">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-bold">היעד שלי</h1>
        <p className="text-sm text-muted-foreground">הגלגל החכם — סובב את ההצלחה</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KpiCard value={`${pct}%`} label="התקדמות" accent />
        <KpiCard icon={Zap} value={goal.xp_total || 0} label="XP כולל" />
        <KpiCard icon={Flame} value={goal.streak || 0} label="רצף ימים" />
      </div>

      {group && (
        <div className="card-lux p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{group.name}</p>
            <p className="text-[10px] text-muted-foreground">מנהל/ת: {group.manager_name || "—"}</p>
          </div>
        </div>
      )}

      {/* Hero card */}
      <div className="card-gold-rim p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="text-[10px] text-primary font-bold tracking-wide">יעד חודשי · {goal.target}</span>
            <h2 className="font-display text-xl font-bold leading-tight mt-0.5">{goal.title}</h2>
            {goal.reward_text && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span className="text-primary">🎁</span> {goal.reward_text}
              </p>
            )}
            {goal.reward_image && (
              <img
                src={mediaUrl(goal.reward_image)}
                alt="הצ'ופר / תגמול"
                className="mt-3 w-full max-h-40 object-cover rounded-xl ring-1 ring-primary/30"
              />
            )}
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-primary font-medium cursor-pointer">
              {uploadingReward ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {goal.reward_image ? "החלפת תמונת תמריץ" : "העלאת תמונת תמריץ"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                className="hidden"
                disabled={uploadingReward}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) uploadRewardImage(f);
                }}
              />
            </label>
            {!goal.reward_text && !goal.reward_image && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-primary" /> אין תגמול מוגדר עדיין
              </p>
            )}
            {goal.is_hidden && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground mt-2">
                <EyeOff className="w-3 h-3" /> יעד חסוי
              </span>
            )}
          </div>
          <div className={`flex flex-col items-center gap-1.5 shrink-0 w-[120px] p-2.5 rounded-xl ${goal.is_hidden ? "bg-primary/10 border border-primary/30" : "bg-muted/40"}`}>
            <span className={`text-[10px] text-center leading-tight font-medium ${goal.is_hidden ? "text-primary" : "text-muted-foreground"}`}>
              {goal.is_hidden ? "🔒 היעד מוסתר מהליגה" : "פרטיות יעד"}
            </span>
            <span className="text-[9px] text-muted-foreground/80 text-center leading-tight">
              {goal.is_hidden ? "רק את/ה רואה את היעד" : "הסתר מהמשתתפים האחרים"}
            </span>
            <div className="flex items-center gap-1">
              <Switch checked={goal.is_hidden} onCheckedChange={toggleHidden} />
              {goal.is_hidden ? <EyeOff className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Wheel — own view never blanks on hide; hide only affects peers */}
      <div className="flex justify-center py-2">
        <SmartWheel
          tasks={tasks}
          onToggle={(t) => toggleTask(t)}
          onSwap={hideDomainSwap || isAdmin ? undefined : swapTasks}
          hidden={false}
          size={340}
          goalTitle={goal.title}
        />
      </div>

      {/* Task list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">רשימת משימות ({tasks.length})</h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-primary text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> הוסף משימה
          </button>
        </div>

        {showAdd && (
          <div className="card-lux p-3 space-y-2">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="כותרת המשימה..."
              className="w-full bg-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              autoFocus
            />
            <button onClick={addTask} className="w-full gold-bg text-black rounded-lg px-5 py-2 text-sm font-bold">
              הוסף
            </button>
          </div>
        )}

        <DragDropContext
          onDragEnd={(result) => {
            if (!result.destination || result.destination.index === result.source.index) return;
            reorder(tasks[result.source.index].id, result.destination.index);
          }}
        >
          <Droppable droppableId="tasks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {tasks.map((task, i) => {
                  const priorityColor =
                    task.priority === "דחוף"
                      ? "bg-destructive/20 text-destructive"
                      : task.priority === "בינוני"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground";
                  return (
                    <Draggable key={task.id} draggableId={task.id} index={i}>
                      {(prov) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          className="card-lux p-3 flex items-center gap-3"
                        >
                          <span {...prov.dragHandleProps} className="cursor-grab text-muted-foreground/50 shrink-0">
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <button
                            onClick={() => toggleTask(task)}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              task.is_completed ? "gold-bg border-primary glow-gold" : "border-muted-foreground/40"
                            }`}
                          >
                            {task.is_completed && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            {editingTaskId === task.id ? (
                              <input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveEditTask(task)}
                                className="w-full bg-input rounded px-2 py-1 text-sm"
                                autoFocus
                              />
                            ) : (
                              <p className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </p>
                            )}
                          </div>
                          {editingTaskId === task.id ? (
                            <button type="button" onClick={() => saveEditTask(task)} className="p-1.5 text-primary">
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button type="button" onClick={() => startEditTask(task)} className="p-1.5 text-muted-foreground hover:text-primary">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => deleteTask(task)} className="p-1.5 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${priorityColor}`}
                            title="דחיפות נקבעת ע״י מנהל/ת"
                          >
                            {task.priority || "בינוני"}
                          </span>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {tasks.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            אין משימות עדיין.
            <br />
            הוסף את המשימה הראשונה שלך! 🚀
          </p>
        )}
      </div>
    </div>
  );
}