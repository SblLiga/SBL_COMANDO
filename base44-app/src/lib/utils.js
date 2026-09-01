import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Newest first (created_date / created_at / id). */
export function sortNewestFirst(items) {
  return [...(items || [])].sort((a, b) => {
    const ta = new Date(a?.created_date || a?.created_at || 0).getTime();
    const tb = new Date(b?.created_date || b?.created_at || 0).getTime();
    if (tb !== ta) return tb - ta;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}

export const isIframe = window.self !== window.top;
