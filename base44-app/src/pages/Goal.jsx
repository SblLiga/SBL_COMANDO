import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, Flame, Plus, Check, EyeOff, Eye, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SmartWheel from "@/components/SmartWheel";
import KpiCard from "@/components/KpiCard";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const PRIORITIES = ["דחוף", "בינוני", "נמוך"];

export default function Goal() {
  const { toast } = useToast();
  const [goal, setGoal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("בינוני");
  const [showAdd, setShowAdd] = useState(false);
  const [xpPerTask, setXpPerTask] = useState(100);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const goals = await base44.entities.Goal.list();
      let g = goals[0];
      if (!g) {
        g = await base44.entities.Goal.create({
          title: "היעד החודשי שלי",
          target: "מכירות",
          is_hidden: false,
          reward_text: "ערב פינוק בספא",
          progress: 0,
          xp_total: 0,
          streak: 3,
        });
      }
      setGoal(g);
      const t = await base44.entities.Task.filter({ goal_id: g.id });
      setTasks(t.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).slice(0, 9));
      try {
        const settings = await base44.entities.SystemSetting.list();
        if (settings[0]?.xp_task) setXpPerTask(settings[0].xp_task);
      } catch (err) {
        console.error("[Goal] Failed to load XP settings:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const recalc = (taskList) => {
    const completed = taskList.filter((t) => t.is_completed).length;
    const pct = taskList.length ? Math.round((completed / taskList.length) * 100) : 0;
    const xp = taskList.filter((t) => t.is_completed).reduce((s, t) => s + (xpPerTask || t.xp_value || 100), 0);
    return { pct, xp };
  };

  const toggleTask = async (task) => {
    const updated = await base44.entities.Task.update(task.id, { is_completed: !task.is_completed });
    const newTasks = tasks.map((t) => (t.id === task.id ? updated : t));
    setTasks(newTasks);
    const { pct, xp } = recalc(newTasks);
    const g = await base44.entities.Goal.update(goal.id, { progress: pct, xp_total: xp });
    setGoal(g);
    // Sync the linked Member entity (dynamic data sync for leaderboard)
    try {
      const user = await base44.auth.me();
      const myMembers = await base44.entities.Member.filter({ user_id: user.id });
      if (myMembers[0]) {
        await base44.entities.Member.update(myMembers[0].id, { xp, progress: pct });
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
    const t = await base44.entities.Task.create({
      goal_id: goal.id,
      title: newTaskTitle,
      order_index: tasks.length,
      is_completed: false,
      priority: newTaskPriority,
      xp_value: xpPerTask,
    });
    setTasks([...tasks, t]);
    setNewTaskTitle("");
    setShowAdd(false);
  };

  const toggleHidden = async (val) => {
    const g = await base44.entities.Goal.update(goal.id, { is_hidden: val });
    setGoal(g);
  };

  const swapTasks = async (i, j) => {
    if (i === j || i < 0 || j < 0 || i >= tasks.length || j >= tasks.length) return;
    const arr = [...tasks];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const reordered = arr.map((t, idx) => ({ ...t, order_index: idx }));
    setTasks(reordered);
    await base44.entities.Task.bulkUpdate(reordered.map((t) => ({ id: t.id, order_index: t.order_index })));
  };

  const reorder = async (taskId, newIndex) => {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1 || newIndex < 0 || newIndex >= tasks.length || idx === newIndex) return;
    const arr = [...tasks];
    const [item] = arr.splice(idx, 1);
    arr.splice(newIndex, 0, item);
    const reordered = arr.map((t, i) => ({ ...t, order_index: i }));
    setTasks(reordered);
    await base44.entities.Task.bulkUpdate(reordered.map((t) => ({ id: t.id, order_index: t.order_index })));
  };

  const cyclePriority = async (task) => {
    const next = PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
    const updated = await base44.entities.Task.update(task.id, { priority: next });
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
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
            {goal.is_hidden && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground mt-2">
                <EyeOff className="w-3 h-3" /> יעד חסוי
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5 shrink-0 w-[110px]">
            <span className="text-[10px] text-muted-foreground text-center leading-tight">
              {goal.is_hidden ? "יעדך נסתר מאחרים" : "הסתר את היעד שלך מאחרים"}
            </span>
            <div className="flex items-center gap-1">
              <Switch checked={goal.is_hidden} onCheckedChange={toggleHidden} />
              {goal.is_hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Wheel */}
      <div className="flex justify-center py-2">
        <SmartWheel tasks={tasks} onToggle={(t) => toggleTask(t)} onSwap={swapTasks} hidden={goal.is_hidden} size={340} />
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
            <div className="flex gap-2 items-center">
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                className="bg-input rounded-lg px-2 py-2 text-sm flex-1"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button onClick={addTask} className="gold-bg text-black rounded-lg px-5 py-2 text-sm font-bold">
                הוסף
              </button>
            </div>
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
                            <p className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                          </div>
                          <button
                            onClick={() => cyclePriority(task)}
                            title="לחץ לשינוי עדיפות"
                            className={`text-[10px] px-2 py-1 rounded-full font-medium cursor-pointer transition-all hover:scale-110 hover:opacity-80 ${priorityColor}`}
                          >
                            {task.priority}
                          </button>
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