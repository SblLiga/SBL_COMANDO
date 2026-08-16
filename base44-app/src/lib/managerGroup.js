import apiClient from "@/api/apiClient";

/**
 * Resolve the group a manager owns via Group.manager_id (canonical),
 * with a legacy fallback to Member.group_id.
 */
export async function resolveManagerOwnedGroup(user) {
  if (!user?.id) return { group: null, member: null };

  const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
  const member = myMembers[0] || null;

  let groups = [];
  try {
    groups = await apiClient.entities.Group.filter({ manager_id: user.id });
  } catch {
    groups = [];
  }

  let group = groups[0] || null;
  if (!group && member?.group_id) {
    const all = await apiClient.entities.Group.list();
    group = all.find((g) => String(g.id) === String(member.group_id)) || null;
  }

  return { group, member };
}

export async function loadManagerGroupMembers(group) {
  if (!group?.id) return [];
  const rows = await apiClient.entities.Member.filter({ group_id: group.id });
  return rows.filter((m) => m.role === "user");
}
