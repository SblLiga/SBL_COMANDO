/**
 * Unified sender label for notification inbox UIs.
 * - admin  -> "הנהלה"
 * - manager -> "ממנהל/ת {name}"
 * - user   -> "{name}"
 */
const ADMIN_RE = /(סופר-?אדמין|הנהל|אדמין)/i;
const GENERIC_MANAGER_RE = /^(המנהל\/ת שלך|מנהל\/ת|המנהל\/ת|ממנהל\/ת)$/;

function isRealName(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (GENERIC_MANAGER_RE.test(s) || ADMIN_RE.test(s)) return false;
  return true;
}

export function formatNotificationSender(n, { usersById, membersByUserId } = {}) {
  if (!n) return "";

  const uid = n.source_user_id != null && n.source_user_id !== "" ? Number(n.source_user_id) : null;
  const user = uid != null ? usersById?.get(uid) : null;
  const member = uid != null ? membersByUserId?.get(uid) : null;
  const role = String(user?.role || member?.role || "").toLowerCase();
  const resolvedName =
    (isRealName(member?.name) && member.name) ||
    (isRealName(user?.full_name) && user.full_name) ||
    (isRealName(n.source) ? n.source : null);

  if (
    role === "admin" ||
    ADMIN_RE.test(String(n.source || "")) ||
    ADMIN_RE.test(String(n.title || ""))
  ) {
    return "הנהלה";
  }

  if (role === "manager") {
    return resolvedName ? `ממנהל/ת ${resolvedName}` : "ממנהל/ת";
  }

  // Infer manager from legacy stamps when role map is unavailable to the viewer.
  if (
    GENERIC_MANAGER_RE.test(String(n.source || "").trim()) ||
    String(n.title || "").includes("מהמנהל")
  ) {
    return resolvedName ? `ממנהל/ת ${resolvedName}` : "ממנהל/ת";
  }

  return resolvedName || (isRealName(n.source) ? n.source : "") || "משתמש/ת";
}

/** Prefer source_user_id; fall back to member/user lookup by source name. */
export async function resolveReplyTargetUserId(n, { members = [], fetchAdmins } = {}) {
  if (n?.source_user_id != null && n.source_user_id !== "") {
    return Number(n.source_user_id);
  }
  if (n?.source) {
    const byName = members.find((m) => m.name === n.source);
    if (byName?.user_id != null) return Number(byName.user_id);
    if (ADMIN_RE.test(String(n.source)) && typeof fetchAdmins === "function") {
      const admins = await fetchAdmins();
      if (admins?.[0]?.id != null) return Number(admins[0].id);
    }
  }
  return null;
}
