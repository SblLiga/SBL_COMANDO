import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import api from "@/api/dataLayer";
import { Zap } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

const LOGO_URL = "/logo.png";

export default function Header({ hideUser = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);

  useEffect(() => {
    if (hideUser || !user?.id) return;
    let cancelled = false;
    api.entities.Member.filter({ user_id: user.id })
      .then((res) => {
        if (!cancelled) setMember(res[0] || null);
      })
      .catch((err) => console.error("[Header] Member fetch failed:", err));
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.avatar_url, hideUser]);

  const name = member?.name || user?.full_name || "משתמש";
  // Prefer user.avatar_url (just patched) and durable /api/media over legacy /uploads
  const avatarSrc =
    [user?.avatar_url, member?.avatar_url].find(
      (u) => typeof u === "string" && u.startsWith("/api/media/")
    ) ||
    user?.avatar_url ||
    member?.avatar_url ||
    "";
  const xp = member?.xp || 0;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border" dir="rtl">
      <div className="flex items-center justify-between px-4 h-14 max-w-md lg:max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() =>
            navigate(user?.role === "admin" ? "/admin" : user?.role === "manager" ? "/manager" : "/")
          }
          className="flex items-center gap-2 min-w-0 active:opacity-80"
          aria-label="שולי בן לולו — דף הבית"
        >
          <img
            src={LOGO_URL}
            alt="שולי בן לולו"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full ring-1 ring-primary/40 object-cover shrink-0 bg-black"
          />
          <div className="flex flex-col leading-none text-right min-w-0">
            <span className="font-display text-sm font-bold gold-text truncate">שולי בן לולו</span>
            <span className="text-[8px] text-muted-foreground tracking-wide truncate">ליגת &quot;כובשים יעדים&quot;</span>
          </div>
        </button>

        {!hideUser && (
          <div className="flex items-center gap-2.5 shrink-0">
            {xp > 0 && (
              <span className="flex items-center gap-0.5 text-xs gold-text font-bold">
                <Zap className="w-3 h-3" />
                {xp}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1.5 active:opacity-70"
              aria-label="הפרופיל שלי"
            >
              <span className="text-xs font-medium hidden sm:block max-w-[80px] truncate">{name}</span>
              <UserAvatar src={avatarSrc} name={name} className="w-8 h-8 ring-1 ring-primary/30" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
