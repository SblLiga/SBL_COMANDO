import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import api from "@/api/dataLayer";
import { Zap } from "lucide-react";

const LOGO_URL = "/logo.svg";

export default function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.entities.Member.filter({ user_id: user.id })
      .then((res) => { if (!cancelled) setMember(res[0] || null); })
      .catch((err) => console.error("[Header] Member fetch failed:", err));
    return () => { cancelled = true; };
  }, [user?.id]);

  const name = member?.name || user?.full_name || "משתמש";
  const avatar = member?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a1a&color=C5A880&bold=true`;
  const xp = member?.xp || 0;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border" dir="rtl">
      <div className="flex items-center justify-between px-4 h-14 max-w-md lg:max-w-3xl mx-auto">
        {/* Logo — שולי בן לולו */}
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="שולי בן לולו" className="w-9 h-9 rounded-full ring-1 ring-primary/30" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold gold-text">שולי בן לולו</span>
            <span className="text-[8px] text-muted-foreground tracking-wide">ליגת "כובשים יעדים"</span>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5">
          {xp > 0 && (
            <span className="flex items-center gap-0.5 text-xs gold-text font-bold">
              <Zap className="w-3 h-3" />
              {xp}
            </span>
          )}
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 active:opacity-70"
          >
            <span className="text-xs font-medium hidden sm:block max-w-[80px] truncate">{name}</span>
            <img src={avatar} alt={name} className="w-8 h-8 rounded-full ring-1 ring-primary/30 cursor-pointer" />
          </button>
        </div>
      </div>
    </header>
  );
}