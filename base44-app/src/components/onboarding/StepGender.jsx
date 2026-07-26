import React from "react";
import { Users } from "lucide-react";

export default function StepGender({ gender, setGender }) {
  return (
    <>
      <div className="text-center">
        <Users className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">בחירת אזור</h2>
        <p className="text-xs text-muted-foreground">לסינון מנהלים תואמים (הפרדה לאזורים)</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setGender("female")}
          className={`p-5 rounded-xl font-bold ${gender === "female" ? "gold-bg text-black glow-gold" : "bg-muted"}`}
        >
          אזור נשים
        </button>
        <button
          type="button"
          onClick={() => setGender("male")}
          className={`p-5 rounded-xl font-bold ${gender === "male" ? "gold-bg text-black glow-gold" : "bg-muted"}`}
        >
          אזור גברים
        </button>
      </div>
    </>
  );
}
