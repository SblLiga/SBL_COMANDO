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

export default function Onboarding() {
  const navigate = useNavigate();
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

  useEffect(() => {
    (async () => {
      try {
        const u = await apiClient.auth.me();
        setUser(u);
        if (u?.gender) setGender(u.gender);
        if (u?.target) setTarget(u.target);
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
  }, []);

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
    setUploading(true);
    try {
      const res = await apiClient.integrations.Core.UploadFile({ file });
      setRewardImage(res.file_url);
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      const ownedGoals = await apiClient.entities.Goal.filter({ owner_user_id: user.id });
      let goal = ownedGoals.sort(
        (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
      )[0];
      if (goal) {
        goal = await apiClient.entities.Goal.update(goal.id, {
          title: goalTitle || goal.title || `יעד חודשי - ${target}`,
          target,
          reward_text: rewardText || goal.reward_text,
          reward_image: rewardImage || goal.reward_image,
        });
        const existingTasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
        if (existingTasks.length === 0 && tasks.length) {
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
      } else {
        goal = await apiClient.entities.Goal.create({
          title: goalTitle || `יעד חודשי - ${target}`,
          target,
          is_hidden: false,
          reward_text: rewardText,
          reward_image: rewardImage,
          progress: 0,
          xp_total: 0,
          streak: 0,
          owner_user_id: user.id,
        });
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

      if (manager?.id === "waiting_list") {
        const existing = await apiClient.entities.Member.filter({ user_id: user.id });
        if (existing[0]) {
          await apiClient.entities.Member.update(existing[0].id, {
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
          });
        } else {
          await apiClient.entities.Member.create({
            name: user?.full_name || user?.email || "משתמש חדש",
            user_id: user.id,
            goal_id: goal.id,
            goal_title: goal.title,
            goal_hidden: false,
            gender,
            target,
            xp: 0,
            progress: 0,
            streak: 0,
            role: "user",
            status: "דרושה התייחסות",
          });
        }

        await apiClient.auth.updateMe({
          gender,
          target,
          onboarding_completed: true,
        });

        navigate("/");
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
          manager_id: manager.id,
          participant_count: 1,
          max_participants: 5,
          status: "on_track",
          avg_progress: 0,
        });
      } else {
        group = await apiClient.entities.Group.update(group.id, {
          participant_count: (group.participant_count || 0) + 1,
        });
      }

      const existing = await apiClient.entities.Member.filter({ user_id: user.id });
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
      };
      if (existing[0]) {
        await apiClient.entities.Member.update(existing[0].id, memberPayload);
      } else {
        await apiClient.entities.Member.create({
          ...memberPayload,
          user_id: user.id,
          xp: 0,
          progress: 0,
          streak: 0,
        });
      }

      await apiClient.auth.updateMe({
        gender,
        target,
        group_id: group.id,
        onboarding_completed: true,
      });

      navigate("/");
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

  const canNext = [
    !!target,
    !!gender,
    !!manager,
    tasks.length >= 4,
    !!rewardText || !!rewardImage,
  ][step];

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-md lg:max-w-xl mx-auto">
        <StepProgress step={step} />

        <div className="card-gold-rim p-5 space-y-4">
          {step === 0 && <StepTarget target={target} setTarget={setTarget} />}
          {step === 1 && <StepGender gender={gender} setGender={setGender} />}
          {step === 2 && <StepManager managers={managers} groups={groups} gender={gender} target={target} manager={manager} setManager={setManager} />}
          {step === 3 && <StepTasks target={target} tasks={tasks} toggleTask={toggleTask} customTask={customTask} setCustomTask={setCustomTask} addCustomTask={addCustomTask} removeTask={removeTask} />}
          {step === 4 && <StepReward goalTitle={goalTitle} setGoalTitle={setGoalTitle} rewardText={rewardText} setRewardText={setRewardText} rewardImage={rewardImage} uploading={uploading} uploadReward={uploadReward} />}

          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="flex-1 bg-muted rounded-xl py-2.5 text-sm font-bold">
                חזרה
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canNext && setStep(step + 1)}
                disabled={!canNext}
                className="flex-1 gold-bg text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
              >
                המשך ←
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={!canNext || submitting}
                className="flex-1 gold-gradient text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "סיום והתחלה! 🚀"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}