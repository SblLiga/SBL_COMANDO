/** Fixed Meshulam/Grow checkout link with user id in custom1 (for Make webhook matching). */
const GROW_PAYMENT_BASE =
  import.meta.env.VITE_GROW_PAYMENT_URL ||
  "https://meshulam.co.il/s/180deaa3-f766-9c23-5820-a8a91ea5a1ff";

export function buildGrowPaymentUrl(userId) {
  const base = GROW_PAYMENT_BASE.replace(/\/$/, "");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}custom1=${encodeURIComponent(String(userId))}`;
}
