import React, { useState } from "react";
import { resolveAvatar, fallbackAvatar } from "@/lib/mediaUrl";

/**
 * Shared circular avatar — uses uploaded profile image with letter fallback.
 */
export default function UserAvatar({
  src,
  name = "משתמש",
  className = "w-9 h-9",
  alt,
}) {
  const [broken, setBroken] = useState(false);
  const resolved = broken ? fallbackAvatar(name) : resolveAvatar(src, name);

  return (
    <img
      src={resolved}
      alt={alt || name}
      className={`${className} rounded-full object-cover ring-1 ring-border shrink-0 bg-muted`}
      onError={() => {
        if (!broken) setBroken(true);
      }}
      loading="lazy"
    />
  );
}
