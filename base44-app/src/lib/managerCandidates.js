/**
 * Managers shown in onboarding for a target/gender pair.
 * Kept outside the React component so the post-promotion path can be tested
 * against exactly the same filtering used by StepManager.
 */
export function getMatchingManagers(managers, { gender, target }) {
  const seenUserIds = new Set();
  const matches = [];

  for (const manager of managers || []) {
    if (manager.role !== "manager") continue;
    if (!gender || !manager.gender || manager.gender !== gender) continue;

    const effectiveTarget = manager.next_month_target || manager.target;
    if (target && effectiveTarget !== target) continue;
    if (!manager.user_id) continue;

    const userId = String(manager.user_id);
    if (seenUserIds.has(userId)) continue;
    seenUserIds.add(userId);
    matches.push(manager);
  }

  return matches;
}
