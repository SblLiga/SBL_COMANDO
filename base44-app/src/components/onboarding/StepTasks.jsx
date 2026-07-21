import React from "react";
import { ListChecks, Check, Plus, X } from "lucide-react";
import { TASK_BANK } from "./onboardingData";

export default function StepTasks({ target, tasks, toggleTask, customTask, setCustomTask, addCustomTask, removeTask }) {
  return (
    <>
      <div className="text-center">
        <ListChecks className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחר/י משימות</h2>
        <p className="text-xs text-muted-foreground">מינימום 4, מקסימום 9 · נבחרו {tasks.length}</p>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {(TASK_BANK[target] || TASK_BANK["אחר"]).map((t) => (
          <button
            key={t}
            onClick={() => toggleTask(t)}
            className={`w-full text-right p-2.5 rounded-lg text-sm flex items-center gap-2 ${tasks.includes(t) ? "gold-bg text-black" : "bg-muted"}`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${tasks.includes(t) ? "border-black" : "border-muted-foreground/40"}`}>
              {tasks.includes(t) && <Check className="w-3 h-3" />}
            </div>
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={customTask}
          onChange={(e) => setCustomTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomTask()}
          placeholder="משימה מותאמת אישית..."
          className="flex-1 bg-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={addCustomTask} className="gold-bg text-black rounded-lg px-3"><Plus className="w-4 h-4" /></button>
      </div>
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tasks.map((t) => (
            <span key={t} className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-full flex items-center gap-1">
              {t}
              <button onClick={() => removeTask(t)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}