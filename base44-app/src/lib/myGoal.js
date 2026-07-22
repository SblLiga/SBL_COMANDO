/**
 * Shared goal loading — always scope to the current user.
 * Prefer Member.goal_id, then Goal.filter({ owner_user_id }), never raw Goal.list()[0].
 */
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

export async function ensureMyGoal(apiClient, defaults = {}) {
  const loaded = await loadMyGoal(apiClient);
  if (loaded.goal) return loaded;

  const goal = await apiClient.entities.Goal.create({
    title: defaults.title || "היעד החודשי שלי",
    target: defaults.target || "מכירות",
    is_hidden: false,
    reward_text: defaults.reward_text || "",
    progress: 0,
    xp_total: 0,
    streak: 0,
    owner_user_id: loaded.user.id,
  });

  if (loaded.member) {
    await apiClient.entities.Member.update(loaded.member.id, {
      goal_id: goal.id,
      goal_title: goal.title,
    });
  }

  return { ...loaded, goal };
}
