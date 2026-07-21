import React from "react";
import { Check } from "lucide-react";
import { STEPS } from "./onboardingData";

export default function StepProgress({ step }) {
  return (
    <div className="flex items-center justify-between mb-6 pt-4">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? "gold-bg text-black" : i === step ? "gold-bg text-black glow-gold" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-[9px] ${i === step ? "text-primary font-bold" : "text-muted-foreground"}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}