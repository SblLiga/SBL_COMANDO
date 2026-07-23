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
      key={src || name}
      src={resolved}
      alt={alt || name}
      className={`${className} rounded-full object-cover ring-1 ring-border shrink-0 bg-muted`}
      onError={() => {
        // Stale error from revoked blob preview — ignore if src already moved on
        if (srcRef.current !== src) return;
        if (typeof src === "string" && src.startsWith("blob:")) return;
        setBroken(true);
      }}
    />
  );
}
