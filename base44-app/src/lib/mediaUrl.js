/**
 * Resolve media URLs for production + local.
 * Relative `/uploads/...` must hit the API host (same origin in EB, or VITE_API_URL in Vite).
 */
export function mediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

export function fallbackAvatar(name = "משתמש") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a1a&color=C5A880&bold=true`;
}

export function resolveAvatar(avatarUrl, name) {
  return mediaUrl(avatarUrl) || fallbackAvatar(name);
}
