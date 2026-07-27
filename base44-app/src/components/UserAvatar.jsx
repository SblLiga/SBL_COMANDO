import React, { useEffect, useRef, useState } from "react";
import { resolveAvatar, fallbackAvatar } from "@/lib/mediaUrl";

/**
 * Shared circular avatar — uploaded image with letter fallback.
 * Ignores stale onError from a revoked blob: URL after src already changed.
 */
export default function UserAvatar({
  src,
  name = "משתמש",
  className = "w-9 h-9",
  alt,
}) {
  const [broken, setBroken] = useState(false);
  const srcRef = useRef(src);

  useEffect(() => {
    srcRef.current = src;
    setBroken(false);
  }, [src]);

  const resolved = broken ? fallbackAvatar(name) : resolveAvatar(src, name);

  return (
    <img
      key={resolved}
      src={resolved}
      alt={alt || name}
      className={`${className} rounded-full object-cover ring-1 ring-border shrink-0 bg-muted`}
      onError={() => {
        if (srcRef.current !== src) return;
        if (typeof src === "string" && src.startsWith("blob:")) return;
        // One soft retry for durable media (cache/race right after upload)
        if (typeof resolved === "string" && resolved.includes("/api/media/") && !broken) {
          const img = new Image();
          img.onload = () => setBroken(false);
          img.onerror = () => setBroken(true);
          img.src = `${resolved}${resolved.includes("?") ? "&" : "?"}t=${Date.now()}`;
          return;
        }
        setBroken(true);
      }}
    />
  );
}
