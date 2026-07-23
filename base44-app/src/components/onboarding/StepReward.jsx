import React from "react";
import { Gift, Upload, Loader2 } from "lucide-react";
import { mediaUrl } from "@/lib/mediaUrl";

export default function StepReward({
  goalTitle,
  setGoalTitle,
  rewardText,
  setRewardText,
  rewardImage,
  uploading,
  uploadReward,
  isNewCycle = false,
}) {
  const preview = mediaUrl(rewardImage);

  return (
    <>
      <div className="text-center">
        <Gift className="w-8 h-8 text-primary mx-auto mb-2" />
        <h2 className="font-display text-xl font-bold">
          {isNewCycle ? "תגמול לסבב החדש" : "תגמול אישי"}
        </h2>
        <p className="text-xs text-muted-foreground">הפרס שלך ל-100% השלמה</p>
      </div>
      <input
        value={goalTitle}
        onChange={(e) => setGoalTitle(e.target.value)}
        placeholder="כותרת היעד (אופציונלי)"
        className="w-full bg-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <textarea
        value={rewardText}
        onChange={(e) => setRewardText(e.target.value)}
        placeholder="תאר/י את התגמול שלך... (לדוגמה: סופ״ש במלון בוטיק)"
        className="w-full bg-input rounded-lg px-3 py-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block cursor-pointer">
        <div
          className={`card-lux p-4 flex flex-col items-center gap-2 transition-colors ${
            rewardImage ? "border-primary/50" : "hover:border-primary/30"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          ) : preview ? (
            <img src={preview} alt="תגמול" className="w-full h-28 object-cover rounded-lg" />
          ) : (
            <Upload className="w-6 h-6 text-primary" />
          )}
          <span className="text-xs text-muted-foreground">
            {rewardImage ? "תמונה הועלתה ✓ (לחיצה להחלפה)" : "העלאת תמונת תגמול (אופציונלי)"}
          </span>
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadReward(file);
            e.target.value = "";
          }}
        />
      </label>
    </>
  );
}
