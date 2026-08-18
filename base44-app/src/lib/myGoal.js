/**
 * Shared goal loading — always scope to the current user.
 * Prefer Member.goal_id, then Goal.filter({ owner_user_id }), never raw Goal.list()[0].
 * Managers/admins: quietly ensure a Member card exists so XP/league can attach.
 * Monthly cycle (from day 25 → next YYYY-MM): reset Goal.xp_total / Member.xp for everyone.
 */
import { currentCycleMonth } from "@/lib/calendarRules";

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
 */
async function ensureGoalCycle(apiClient, { user, member, goal }) {
  if (!goal) return { user, member, goal };

  const cycle = currentCycleMonth();
  if (!goal.cycle_month) {
    const stamped = await apiClient.entities.Goal.update(goal.id, { cycle_month: cycle });
    return { user, member, goal: stamped };
  }

  if (goal.cycle_month === cycle) {
    return { user, member, goal };
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
    });
  }

  return { user, member: nextMember, goal: resetGoal };
}

export async function ensureMyGoal(apiClient, defaults = {}) {
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
    return ensureGoalCycle(apiClient, loaded);
  }

  const cycle = currentCycleMonth();
  const target = defaults.target || loaded.user?.target || loaded.member?.target || "מכירות";
  const goal = await apiClient.entities.Goal.create({
    title: defaults.title || `יעד חודשי - ${target}`,
    target,
    is_hidden: false,
    reward_text: defaults.reward_text || "",
    progress: 0,
    xp_total: 0,
    streak: 0,
    owner_user_id: loaded.user.id,
    cycle_month: cycle,
  });

  let member = loaded.member;
  if (member) {
    member = await apiClient.entities.Member.update(member.id, {
      goal_id: goal.id,
      goal_title: goal.title,
      target: member.target || target,
      xp: 0,
      progress: 0,
    });
  }

  return { ...loaded, member, goal };
}
