import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { STEPS } from "@/components/onboarding/onboardingData";
import StepProgress from "@/components/onboarding/StepProgress";
import StepTarget from "@/components/onboarding/StepTarget";
import StepGender from "@/components/onboarding/StepGender";
import StepManager from "@/components/onboarding/StepManager";
import StepTasks from "@/components/onboarding/StepTasks";
import StepReward from "@/components/onboarding/StepReward";
import { toast } from "@/components/ui/use-toast";
import { currentCycleMonth, needsMonthlyOnboarding, canAssignToGroup } from "@/lib/calendarRules";
import { needsOnboardingWizard, needsPayment } from "@/lib/postAuth";
import { isPendingAccessLocked, shouldBypassOnboarding } from "@/lib/subscriptionUtils";
import { prepareImageForUpload, formatUploadError } from "@/lib/prepareImageUpload";
import { useAuth } from "@/lib/AuthContext";

export default function Onboarding() {
  const navigate = useNavigate();
  const { applyUser } = useAuth();
  const [step, setStep] = useState(0);
  const [user, setUser] = useState(null);
  const [target, setTarget] = useState("");
  const [gender, setGender] = useState("");
  const [manager, setManager] = useState(null);
  const [managers, setManagers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [customTask, setCustomTask] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [rewardText, setRewardText] = useState("");
  const [rewardImage, setRewardImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isNewCycle, setIsNewCycle] = useState(false);

  const assignmentOpen = canAssignToGroup(user);
  const waitEnrollment = Boolean(user) && !assignmentOpen;
  const hardPendingLock = isPendingAccessLocked(user);

  useEffect(() => {
    (async () => {
      try {
        const u = await apiClient.auth.me();
        setUser(u);
        if (needsPayment(u)) {
          navigate("/payment", { replace: true });
          return;
        }
        if (u?.role === "user" && u?.onboarding_completed && isPendingAccessLocked(u)) {
          navigate("/pending", { replace: true });
          return;
        }
        if (u?.role === "user" && shouldBypassOnboarding(u)) {
          navigate("/", { replace: true });
          return;
        }
        const monthly = needsMonthlyOnboarding(u);
        setIsNewCycle(Boolean(u?.onboarding_completed && monthly));
        if (u?.role === "user" && !needsOnboardingWizard(u)) {
          navigate("/", { replace: true });
          return;
        }
        if (u?.gender) setGender(u.gender);
        // For a brand-new monthly cycle, force re-pick of target (don't lock old one)
        if (u?.target && !monthly) setTarget(u.target);
        const [m, g] = await Promise.all([
          apiClient.entities.Member.list(),
          apiClient.entities.Group.list(),
        ]);
        setManagers(m);
        setGroups(g);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const toggleTask = (t) => {
    if (tasks.includes(t)) setTasks(tasks.filter((x) => x !== t));
    else if (tasks.length < 9) setTasks([...tasks, t]);
  };

  const addCustomTask = () => {
    const t = customTask.trim();
    if (!t) return;
    if (!tasks.includes(t) && tasks.length < 9) setTasks([...tasks, t]);
    setCustomTask("");
  };

  const removeTask = (t) => setTasks(tasks.filter((x) => x !== t));

  const uploadReward = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const res = await apiClient.integrations.Core.UploadFile({ file: prepared, purpose: "reward" });
      const url = res?.file_url || res?.url;
      if (!url) throw new Error("השרת לא החזיר קישור לתמונה");
      setRewardImage(url);
      toast({ title: "התמונה הועלתה", description: "תמונת התגמול נשמרה." });
    } catch (err) {
      console.error("[Onboarding] reward upload failed", err);
      toast({
        title: "העלאה נכשלה",
        description: formatUploadError(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const createCycleGoalWithTasks = async () => {
    const cycle = currentCycleMonth();
    const goal = await apiClient.entities.Goal.create({
      title: goalTitle || `יעד חודשי - ${target}`,
      target,
      is_hidden: false,
      reward_text: rewardText.trim(),
      reward_image: rewardImage || null,
      progress: 0,
      xp_total: 0,
      streak: 0,
      owner_user_id: user.id,
      cycle_month: cycle,
    });
    if (tasks.length) {
      await apiClient.entities.Task.bulkCreate(
        tasks.map((t, i) => ({
          goal_id: goal.id,
          title: t,
          order_index: i,
          is_completed: false,
          priority: "בינוני",
          xp_value: 100,
        }))
      );
    }
    return goal;
  };

  const leaveOldGroupIfNeeded = async (member, newGroupId) => {
    if (!member?.group_id) return;
    if (String(member.group_id) === String(newGroupId)) return;
    try {
      const old = await apiClient.entities.Group.get(member.group_id);
      const nextCount = Math.max(0, (old.participant_count || 1) - 1);
      await apiClient.entities.Group.update(old.id, { participant_count: nextCount });
    } catch (err) {
      console.warn("[Onboarding] could not decrement old group", err);
    }
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      const existingRows = await apiClient.entities.Member.filter({ user_id: user.id });
      const existing = existingRows[0] || null;
      // Returning from waiting list (already has a wheel for this cycle): assign only.
      const assignmentOnly =
        Boolean(user?.onboarding_completed) &&
        Boolean(existing?.goal_id) &&
        !needsMonthlyOnboarding(user);

      let goal;
      if (assignmentOnly) {
        goal = {
          id: existing.goal_id,
          title: existing.goal_title || `יעד חודשי - ${target}`,
        };
      } else {
        goal = await createCycleGoalWithTasks();
      }

      if (manager?.id === "waiting_list") {
        const payload = {
          name: user?.full_name || user?.email || "משתמש חדש",
          goal_id: goal.id,
          goal_title: goal.title,
          goal_hidden: false,
          gender,
          target,
          group_name: null,
          group_id: null,
          role: "user",
          status: "דרושה התייחסות",
          progress: assignmentOnly ? existing?.progress || 0 : 0,
          xp: assignmentOnly ? existing?.xp || 0 : 0,
          streak: assignmentOnly ? existing?.streak || 0 : 0,
        };
        if (existing) {
          await leaveOldGroupIfNeeded(existing, null);
          await apiClient.entities.Member.update(existing.id, payload);
        } else {
          await apiClient.entities.Member.create({ ...payload, user_id: user.id });
        }

        const me = await apiClient.auth.updateMe({
          gender,
          target,
          group_id: null,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        });
        if (me) {
          applyUser?.(me);
          setUser(me);
        }

        toast({
          title: isNewCycle ? "סבב חדש נשמר" : "הרשמה הושלמה",
          description: hardPendingLock
            ? "חשבונך מוקפא עד פתיחת השיבוצים ב-25 בחודש."
            : waitEnrollment
              ? "המנוי פעיל. השיבוץ לקבוצות יפתח ב-25 בחודש — נתראה אז!"
              : isNewCycle
                ? "הגלגל החדש מוכן. השיבוץ לקבוצה ייפתח לפי לוח השנה."
                : "נשבץ אותך לקבוצה מה־25 לחודש.",
        });
        // No group after waiting_list finish — always land on /pending (not dashboard).
        navigate("/pending", { replace: true });
        return;
      }

      let group = groups.find(
        (g) =>
          g.target === target &&
          g.gender === gender &&
          g.manager_name === manager.name &&
          (g.participant_count || 0) < 5
      );
      if (!group) {
        group = await apiClient.entities.Group.create({
          name: `${target} - ${manager.name}`,
          target,
          gender,
          manager_name: manager.name,
          manager_id: manager.user_id || manager.id,
          participant_count: 1,
          max_participants: 5,
          status: "on_track",
          avg_progress: 0,
        });
      } else if (!existing || String(existing.group_id) !== String(group.id)) {
        group = await apiClient.entities.Group.update(group.id, {
          participant_count: (group.participant_count || 0) + 1,
        });
      }

      if (existing) {
        await leaveOldGroupIfNeeded(existing, group.id);
      }

      const memberPayload = {
        name: user?.full_name || user?.email || "משתמש חדש",
        goal_id: goal.id,
        goal_title: goal.title,
        goal_hidden: false,
        gender,
        target,
        group_name: group.name,
        group_id: group.id,
        role: "user",
        status: "בעקבות",
        progress: assignmentOnly ? existing?.progress || 0 : 0,
        xp: existing?.xp || 0,
        streak: assignmentOnly ? existing?.streak || 0 : 0,
      };
      if (existing) {
        await apiClient.entities.Member.update(existing.id, memberPayload);
      } else {
        await apiClient.entities.Member.create({
          ...memberPayload,
          user_id: user.id,
        });
      }

      const me = await apiClient.auth.updateMe({
        gender,
        target,
        group_id: group.id,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      });
      if (me) {
        applyUser?.(me);
        setUser(me);
      }

      toast({
        title: isNewCycle ? "סבב חדש התחיל!" : "ההרשמה הושלמה",
        description: isNewCycle
          ? `גלגל משימות חדש + שיבוץ לקבוצת ${group.name}`
          : `שובצת לקבוצת ${group.name}`,
      });
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[Onboarding] finish failed", err);
      toast({
        title: "שגיאה בסיום ההרשמה",
        description: err.message || "לא הצלחנו לשמור. נסו שוב.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Reward text is required; image is optional.
  // Wait enrollment may finish from the assignment step (no tasks/reward yet).
  const canNext = waitEnrollment && step === 2
    ? Boolean(target && gender && manager)
    : [!!target, !!gender, !!manager, tasks.length >= 4, !!rewardText.trim()][step];

  const finishFromWaitStep = waitEnrollment && step === 2;

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-md lg:max-w-xl mx-auto">
        {isNewCycle && (
          <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-center">
            <p className="text-sm font-bold text-primary">סבב חדש נפתח</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              בחרו יעד, מנהל/ת, גלגל משימות חדש ותגמול — ותשובצו לקבוצה לסבב {currentCycleMonth()}
            </p>
          </div>
        )}
        <StepProgress step={step} />

        <div className="card-gold-rim p-5 space-y-4">
          {step === 0 && <StepTarget target={target} setTarget={(t) => { setTarget(t); setManager(null); }} />}
          {step === 1 && <StepGender gender={gender} setGender={(g) => { setGender(g); setManager(null); }} />}
          {step === 2 && (
            <StepManager
              user={user}
              managers={managers}
              groups={groups}
              gender={gender}
              target={target}
              manager={manager}
              setManager={setManager}
            />
          )}
          {step === 3 && (
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
          {step === 4 && (
            <StepReward
              goalTitle={goalTitle}
              setGoalTitle={setGoalTitle}
              rewardText={rewardText}
              setRewardText={setRewardText}
              rewardImage={rewardImage}
              uploading={uploading}
              uploadReward={uploadReward}
              isNewCycle={isNewCycle}
            />
          )}

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 bg-muted rounded-xl py-2.5 text-sm font-bold"
                >
                  חזרה
                </button>
              )}
              {finishFromWaitStep ? (
                <button
                  type="button"
                  onClick={finish}
                  disabled={!canNext || submitting}
                  className="flex-1 gold-gradient text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "סיום והבנתי"}
                </button>
              ) : step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => canNext && setStep(step + 1)}
                  disabled={!canNext}
                  className="flex-1 gold-bg text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
                >
                  {waitEnrollment ? "המשך להשלמת ההרשמה ←" : "המשך ←"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  disabled={!canNext || submitting || uploading}
                  className="flex-1 gold-gradient text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : waitEnrollment ? (
                    "סיום והבנתי"
                  ) : isNewCycle ? (
                    "סיום והתחלת סבב חדש 🚀"
                  ) : (
                    "סיום והתחלה! 🚀"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
