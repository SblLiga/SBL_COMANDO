import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import api from "@/api/dataLayer";
import { Zap, Bell } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { preferDurableAvatar } from "@/lib/mediaUrl";
import { isAdmin, isManager } from "@/lib/subscriptionUtils";
import { homePathForUser } from "@/components/RoleRoute";

const LOGO_URL = "/logo.png";

/** Managers: open until "טופל" / X-delete. Users: unread (X-delete removes the row). */
function countActiveNotifications(list, forManager) {
  return (list || []).filter((n) => {
    if (n.is_handled) return false;
    if (forManager) return true;
    return !n.is_read;
  }).length;
}

export default function Header({ hideUser = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [unread, setUnread] = useState(0);
  const showBell = !hideUser && !!user && !isAdmin(user);
  const managerBell = isManager(user);
  const alertsPath = managerBell ? "/manager/alerts" : "/messages";

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
  }, [user?.id, user?.avatar_url, user?.full_name, hideUser]);

  useEffect(() => {
    if (!showBell || !user?.id) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      api.entities.Notification.filter({ target_user_id: user.id })
        .then((res) => {
          if (!cancelled) setUnread(countActiveNotifications(res, managerBell));
        })
        .catch(() => {
          if (!cancelled) setUnread(0);
        });
    };
    load();
    window.addEventListener("sbl:notifications-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("sbl:notifications-changed", load);
    };
    // Refetch on route change and when alerts mark handled/dismissed.
  }, [showBell, managerBell, user?.id, location.pathname]);

  const name = member?.name || user?.full_name || "משתמש";
  const avatarSrc = preferDurableAvatar(user?.avatar_url, member?.avatar_url);
  const xp = member?.xp || 0;

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border" dir="rtl">
      <div className="flex items-center justify-between px-4 h-14 max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(homePathForUser(user))}
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
            {showBell && (
              <Link to={alertsPath} className="relative p-1" aria-label="הודעות והתראות">
                <Bell className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                {unread > 0 && (
                  <span className="absolute -top-1 -left-1 bg-destructive text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
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
