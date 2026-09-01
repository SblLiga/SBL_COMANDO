/** Fixed Meshulam/Grow checkout link (sale page URL only — no user params). */
const GROW_PAYMENT_BASE =
  import.meta.env.VITE_GROW_PAYMENT_URL ||
  "https://meshulam.co.il/s/180deaa3-f766-9c23-5820-a8a91ea5a1ff";

export function buildGrowPaymentUrl(_userId) {
  return GROW_PAYMENT_BASE.replace(/\/$/, "");
}
