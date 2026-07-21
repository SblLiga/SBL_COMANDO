import React from "react";
import { Target } from "lucide-react";
import { TARGETS } from "./onboardingData";

export default function StepTarget({ target, setTarget }) {
  return (
    <>
      <div className="text-center">
        <Target className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחר/י יעד</h2>
        <p className="text-xs text-muted-foreground">מה תחום המיקוד שלך לחודש הקרוב?</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TARGETS.map((t) => (
          <button
            key={t}
            onClick={() => setTarget(t)}
            className={`p-3 rounded-xl text-sm font-medium transition-all ${
              target === t ? "gold-bg text-black glow-gold" : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </>
  );
}