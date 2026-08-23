import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { needsManagerNextMonthTarget } from "@/lib/calendarRules";
import { MANAGER_CYCLE_STEPS } from "@/components/onboarding/onboardingData";
import StepProgress from "@/components/onboarding/StepProgress";
import StepTarget from "@/components/onboarding/StepTarget";
import StepGender from "@/components/onboarding/StepGender";
import StepTasks from "@/components/onboarding/StepTasks";
import StepReward from "@/components/onboarding/StepReward";
import { prepareImageForUpload, formatUploadError } from "@/lib/prepareImageUpload";

/**
 * Hard gate from day ≥ 23 until the full next-month plan is saved:
 * target, zone (gender), tasks (≥4), reward.
 * No manager-pick step — the actor is already the manager.
 * No skip / close — ManagerLayout hides the rest of the UI while locked.
 */
export default function ManagerGoalSelection({ onGateState } = {}) {
  const { toast } = useToast();
  const { checkUserAuth } = useAuth();
  const [locked, setLocked] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  const [step, setStep] = useState(0);

  const [target, setTarget] = useState("");
  const [zone, setZone] = useState("");
  const [tasks, setTasks] = useState([]);
  const [customTask, setCustomTask] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [rewardText, setRewardText] = useState("");
  const [rewardImage, setRewardImage] = useState("");
  const [uploading, setUploading] = useState(false);

  const emit = (nextLocked, nextReady = true) => {
    setLocked(nextLocked);
    setReady(nextReady);
    onGateState?.({ locked: nextLocked, ready: nextReady });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await apiClient.auth.me();
        if (String(user?.role || "").toLowerCase() === "admin") {
          if (!cancelled) emit(false, true);
          return;
        }
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0] || null;
        if (cancelled) return;
        setMember(me);

        const role = String(user?.role || me?.role || "").toLowerCase();
        if (role !== "manager") {
          emit(false, true);
          return;
        }

        // Prefill from prior plan / current profile when re-opening mid-flow.
        if (me?.next_month_target) setTarget(me.next_month_target);
        else if (me?.target) setTarget(me.target);
        if (me?.next_month_zone) setZone(me.next_month_zone);
        else if (me?.gender || user.gender) setZone(me?.gender || user.gender);
        if (Array.isArray(me?.next_month_tasks) && me.next_month_tasks.length) {
          setTasks(me.next_month_tasks);
        }
        if (me?.next_month_reward) setRewardText(me.next_month_reward);
        if (me?.next_month_reward_image) setRewardImage(me.next_month_reward_image);

        if (needsManagerNextMonthTarget(me || { role: "manager" })) {
          emit(true, true);
          return;
        }
        emit(false, true);
      } catch (err) {
        console.error("[ManagerGoalSelection]", err);
        if (!cancelled) emit(true, true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTask = (t) => {
    setTasks((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 9) return prev;
      return [...prev, t];
    });
  };

  const addCustomTask = () => {
    const title = customTask.trim();
    if (!title) return;
    setTasks((prev) => {
      if (prev.includes(title) || prev.length >= 9) return prev;
      return [...prev, title];
    });
    setCustomTask("");
  };

  const removeTask = (t) => setTasks((prev) => prev.filter((x) => x !== t));

  const uploadReward = async (file) => {
    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const res = await apiClient.integrations.Core.UploadFile({ file: prepared, purpose: "reward" });
      const url = res?.file_url || res?.url;
      if (!url) throw new Error("השרת לא החזיר קישור לתמונה");
      setRewardImage(url);
      toast({ title: "התמונה הועלתה" });
    } catch (err) {
      toast({
        title: "העלאה נכשלה",
        description: formatUploadError(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return Boolean(target);
    if (step === 1) return zone === "female" || zone === "male";
    if (step === 2) return tasks.length >= 4 && tasks.length <= 9;
    if (step === 3) return Boolean(rewardText.trim());
    return false;
  };

  const save = async () => {
    if (!canNext() || !member || step !== MANAGER_CYCLE_STEPS.length - 1) return;
    setSaving(true);
    try {
      const reward = rewardText.trim();
      const title = goalTitle.trim() || `יעד חודשי - ${target}`;
      const updated = await apiClient.entities.Member.update(member.id, {
        // Keep current-cycle target for matching; next_month_* is the day-23 plan.
        target,
        gender: zone,
        next_month_target: target,
        next_month_zone: zone,
        next_month_tasks: tasks,
        next_month_reward: reward,
        next_month_reward_image: rewardImage || null,
        next_month_selected_at: new Date().toISOString(),
        goal_title: title,
      });
      setMember(updated);
      if (member.user_id) {
        try {
          await apiClient.entities.User.update(member.user_id, {
            target,
            gender: zone,
          });
        } catch {
          /* optional */
        }
      }
      try {
        await checkUserAuth?.();
      } catch {
        /* non-blocking */
      }
      toast({
        title: "תוכנית החודש הבא נשמרה",
        description: `${target} · ${zone === "female" ? "אזור נשים" : "אזור גברים"} · ${tasks.length} משימות`,
      });
      emit(false, true);
    } catch (err) {
      console.error("[ManagerGoalSelection] save failed", err);
      toast({
        title: "שמירה נכשלה",
        description: err?.message || "נסה/י שוב",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !locked) return null;

  const lastStep = step === MANAGER_CYCLE_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card-gold-rim p-5 max-w-md w-full my-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-xs text-muted-foreground">אזור מנהל · חובה מיום 23</p>
          <h2 className="font-display text-lg font-bold">הגדרת המחזור הבא לקבוצה</h2>
          <p className="text-sm text-muted-foreground mt-1">
            יש להשלים יעד, אזור, משימות ותגמול. לא ניתן לדלג — רק אחרי האישור ייפתח אזור המנהל.
          </p>
        </div>

        <StepProgress step={step} steps={MANAGER_CYCLE_STEPS} />

        <div className="space-y-4 min-h-[220px]">
          {step === 0 && <StepTarget target={target} setTarget={setTarget} />}
          {step === 1 && <StepGender gender={zone} setGender={setZone} />}
          {step === 2 && (
            <StepTasks
              target={target}
              tasks={tasks}
              toggleTask={toggleTask}
              customTask={customTask}
              setCustomTask={setCustomTask}
              addCustomTask={addCustomTask}
              removeTask={removeTask}
            />
          )}
          {step === 3 && (
            <StepReward
              goalTitle={goalTitle}
              setGoalTitle={setGoalTitle}
              rewardText={rewardText}
              setRewardText={setRewardText}
              rewardImage={rewardImage}
              uploading={uploading}
              uploadReward={uploadReward}
              isNewCycle
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 bg-muted rounded-xl py-3 font-bold text-sm"
            >
              הקודם
            </button>
          )}
          {!lastStep ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex-1 gold-bg text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40"
            >
              המשך
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!canNext() || saving}
              className="flex-1 gold-bg text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40"
            >
              {saving ? "שומר..." : "אישור ושמירה"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
