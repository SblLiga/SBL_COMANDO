/**
 * Shared goal loading — always scope to the current user.
 * Prefer Member.goal_id, then Goal.filter({ owner_user_id }), never raw Goal.list()[0].
 * Managers/admins: quietly ensure a Member card exists so XP/league can attach.
 * Users: XP cycle from day ≥ 25. Managers: day ≥ 23. Admins: never by calendar —
 * only via resetAdminWheelOnTargetSave when they intentionally save a new target.
 * Never clears next_month_target / group_id on cycle reset.
 */
import { currentCycleMonth } from "./calendarRules.js";

function cycleRolloverDayFor(user, member) {
  const role = String(user?.role || member?.role || "user").toLowerCase();
  if (role === "admin") return null; // no calendar auto-reset
  return role === "manager" ? 23 : 25;
}

/**
 * Admin-only: intentional new target → reset personal wheel XP/progress/tasks.
 * This is the sole reset trigger for admins (never date-based).
 */
export async function resetAdminWheelOnTargetSave(apiClient, { user, member, goal, target }) {
  if (!goal?.id || !target) return { user, member, goal };
  const role = String(user?.role || member?.role || "").toLowerCase();
  if (role !== "admin") return { user, member, goal };

  let tasks = [];
  try {
    tasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
  } catch (err) {
    console.warn("[resetAdminWheelOnTargetSave] task list failed", err);
  }
  await Promise.all(
    (tasks || [])
      .filter((t) => t.is_completed)
      .map((t) => apiClient.entities.Task.update(t.id, { is_completed: false }))
  );

  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM label only (not a calendar gate)
  const resetGoal = await apiClient.entities.Goal.update(goal.id, {
    target,
    title: `יעד חודשי - ${target}`,
    progress: 0,
    xp_total: 0,
    streak: 0,
    cycle_month: stamp,
  });

  let nextMember = member;
  if (member?.id) {
    nextMember = await apiClient.entities.Member.update(member.id, {
      target,
      xp: 0,
      progress: 0,
      streak: 0,
      goal_id: resetGoal.id,
      goal_title: resetGoal.title,
    });
  }
  try {
    await apiClient.entities.User.update(user.id, { target });
  } catch {
    /* optional */
  }

  return { user, member: nextMember, goal: resetGoal };
}

export async function loadMyGoal(apiClient) {
  const user = await apiClient.auth.me();
  const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
  const me = myMembers[0] || null;

  if (me?.goal_id) {
    try {
      const g = await apiClient.entities.Goal.get(me.goal_id);
      if (g) return { user, member: me, goal: g };
    } catch (err) {
      console.warn("[loadMyGoal] Member.goal_id lookup failed", err);
    }
  }

  const owned = await apiClient.entities.Goal.filter({ owner_user_id: user.id });
  const sorted = [...owned].sort(
    (a, b) => new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0)
  );
  return { user, member: me, goal: sorted[0] || null };
}

async function ensureStaffMember(apiClient, user, defaults = {}) {
  const role = (user?.role || "").toLowerCase();
  if (role !== "manager" && role !== "admin") return null;
  const member = await apiClient.entities.Member.create({
    name: user.full_name || user.email || "משתמש",
    user_id: user.id,
    role,
    gender: user.gender || null,
    target: defaults.target || user.target || "מכירות",
    goal_hidden: false,
    progress: 0,
    xp: 0,
    streak: 0,
    status: "בעקבות",
  });
  return member;
}

/**
 * Open a clean XP cycle when Goal.cycle_month lags behind currentCycleMonth().
 * Missing cycle_month is stamped once (no wipe) so legacy rows migrate safely mid-cycle.
 * Only updates xp/progress/streak — never next_month_target / group fields.
 */
async function ensureGoalCycle(apiClient, { user, member, goal }, { resetStats = true } = {}) {
  if (!goal) return { user, member, goal };

  const rolloverDay = cycleRolloverDayFor(user, member);
  // Admins: never auto-reset by calendar.
  if (rolloverDay == null) {
    return { user, member, goal };
  }

  const cycle = currentCycleMonth(new Date(), rolloverDay);
  if (!goal.cycle_month) {
    const stamped = await apiClient.entities.Goal.update(goal.id, { cycle_month: cycle });
    return { user, member, goal: stamped };
  }

  if (goal.cycle_month === cycle) {
    return { user, member, goal };
  }

  // A mid-month promotion keeps the existing score while moving the goal onto
  // the manager cycle label. Regular user/manager flows retain the reset below.
  if (!resetStats) {
    const stamped = await apiClient.entities.Goal.update(goal.id, { cycle_month: cycle });
    return { user, member, goal: stamped };
  }

  // New monthly cycle: zero XP/progress and reopen tasks for a clean league board.
  let tasks = [];
  try {
    tasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
  } catch (err) {
    console.warn("[ensureGoalCycle] task list failed", err);
  }
  await Promise.all(
    (tasks || [])
      .filter((t) => t.is_completed)
      .map((t) => apiClient.entities.Task.update(t.id, { is_completed: false }))
  );

  const resetGoal = await apiClient.entities.Goal.update(goal.id, {
    cycle_month: cycle,
    progress: 0,
    xp_total: 0,
    streak: 0,
  });

  let nextMember = member;
  if (member) {
    nextMember = await apiClient.entities.Member.update(member.id, {
      xp: 0,
      progress: 0,
      streak: 0,
      goal_id: resetGoal.id,
      goal_title: resetGoal.title,
      // Do NOT touch next_month_target / next_month_selected_at / group_id / target.
    });
  }

  return { user, member: nextMember, goal: resetGoal };
}

export async function ensureMyGoal(apiClient, defaults = {}, { resetStats = true } = {}) {
  let loaded = await loadMyGoal(apiClient);
  const role = (loaded.user?.role || "user").toLowerCase();

  if (!loaded.member && (role === "manager" || role === "admin")) {
    const member = await ensureStaffMember(apiClient, loaded.user, defaults);
    loaded = { ...loaded, member };
  }

  if (loaded.goal) {
    if (loaded.member && !loaded.member.goal_id) {
      const member = await apiClient.entities.Member.update(loaded.member.id, {
        goal_id: loaded.goal.id,
        goal_title: loaded.goal.title,
      });
      loaded = { ...loaded, member };
    }
    return ensureGoalCycle(apiClient, loaded, { resetStats });
  }

  const rolloverDay = cycleRolloverDayFor(loaded.user, loaded.member);
  // Admin: plain calendar YYYY-MM stamp (no day-25 advance). Others: role rollover.
  const cycle =
    rolloverDay == null
      ? currentCycleMonth(new Date(), 32)
      : currentCycleMonth(new Date(), rolloverDay);
  const target = defaults.target || loaded.user?.target || loaded.member?.target || "מכירות";
  const goalCreate = {
    title: defaults.title || `יעד חודשי - ${target}`,
    target,
    is_hidden: false,
    reward_text: defaults.reward_text || "",
    owner_user_id: loaded.user.id,
    cycle_month: cycle,
  };
  if (resetStats) {
    goalCreate.progress = 0;
    goalCreate.xp_total = 0;
    goalCreate.streak = 0;
  }
  const goal = await apiClient.entities.Goal.create(goalCreate);

  let member = loaded.member;
  if (member) {
    const memberUpdate = {
      goal_id: goal.id,
      goal_title: goal.title,
      target: member.target || target,
    };
    if (resetStats) {
      memberUpdate.xp = 0;
      memberUpdate.progress = 0;
    }
    member = await apiClient.entities.Member.update(member.id, memberUpdate);
  }

  return { ...loaded, member, goal };
}

/** Create only for the newly supported manager-without-Member case. */
export async function ensureManagerGoalSelectionMember(
  apiClient,
  user,
  member,
  { resetStats = true } = {}
) {
  if (member || String(user?.role || "").toLowerCase() !== "manager") return member;
  const loaded = await ensureMyGoal(apiClient, {}, { resetStats });
  return loaded.member;
}

/**
 * Persist the four-step manager plan. ensureMyGoal intentionally runs before
 * the Member guard so a manager promoted before onboarding can save normally.
 */
export async function saveManagerGoalSelection(
  apiClient,
  {
    member: knownMember = null,
    target,
    zone,
    tasks,
    goalTitle = "",
    rewardText,
    rewardImage = "",
    resetStats = true,
    now = new Date(),
  }
) {
  const reward = rewardText.trim();
  const title = goalTitle.trim() || `יעד חודשי - ${target}`;
  const cycle = currentCycleMonth(now, 23);
  const loaded = await ensureMyGoal(apiClient, { target, title }, { resetStats });
  const currentMember = loaded.member || knownMember;
  if (!currentMember?.id) {
    throw new Error("לא ניתן ליצור רשומת מנהל. נסו שוב.");
  }

  let goal = loaded.goal;
  if (goal?.id) {
    const oldTasks = await apiClient.entities.Task.filter({ goal_id: goal.id });
    await Promise.all((oldTasks || []).map((task) => apiClient.entities.Task.delete(task.id)));
    const goalUpdate = {
      title,
      target,
      reward_text: reward,
      reward_image: rewardImage || null,
      cycle_month: cycle,
    };
    if (resetStats) {
      goalUpdate.progress = 0;
      goalUpdate.xp_total = 0;
      goalUpdate.streak = 0;
    }
    goal = await apiClient.entities.Goal.update(goal.id, goalUpdate);
  } else {
    const goalCreate = {
      title,
      target,
      is_hidden: false,
      reward_text: reward,
      reward_image: rewardImage || null,
      owner_user_id: loaded.user.id,
      cycle_month: cycle,
    };
    if (resetStats) {
      goalCreate.progress = 0;
      goalCreate.xp_total = 0;
      goalCreate.streak = 0;
    }
    goal = await apiClient.entities.Goal.create(goalCreate);
  }

  if (tasks.length) {
    await apiClient.entities.Task.bulkCreate(
      tasks.map((task, index) => ({
        goal_id: goal.id,
        title: task,
        order_index: index,
        is_completed: false,
        priority: "בינוני",
        xp_value: 100,
      }))
    );
  }

  const memberUpdate = {
    target,
    gender: zone,
    next_month_target: target,
    next_month_zone: zone,
    next_month_tasks: tasks,
    next_month_reward: reward,
    next_month_reward_image: rewardImage || null,
    next_month_selected_at: now.toISOString(),
    goal_id: goal.id,
    goal_title: goal.title || title,
  };
  if (resetStats) {
    memberUpdate.progress = 0;
    memberUpdate.xp = 0;
    memberUpdate.streak = 0;
  }
  const member = await apiClient.entities.Member.update(currentMember.id, memberUpdate);

  if (currentMember.user_id) {
    try {
      await apiClient.entities.User.update(currentMember.user_id, { target, gender: zone });
    } catch {
      /* optional — managers may lack User.update privilege */
    }
  }

  return { user: loaded.user, member, goal };
}
