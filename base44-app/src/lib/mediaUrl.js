/**
 * Resolve media URLs for production + local.
 * Relative `/api/media/...` and `/uploads/...` hit the API host
 * (same origin in EB, or VITE_API_URL in Vite).
 */
export function mediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Drop broken absolute hosts from old DEV/local saves
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
    try {
      const path = new URL(url).pathname;
      return mediaUrl(path);
    } catch {
      return "";
    }
  }
  if (/^https?:\/\//i.test(url)) return url;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

export function fallbackAvatar(name = "משתמש") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a1a&color=C5A880&bold=true`;
}

export function preferDurableAvatar(...candidates) {
  const list = candidates.filter((u) => typeof u === "string" && u.trim());
  const durable = list.find((u) => u.includes("/api/media/"));
  return durable || list[0] || "";
}

export function resolveAvatar(avatarUrl, name) {
  return mediaUrl(avatarUrl) || fallbackAvatar(name);
}
