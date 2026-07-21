import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Target, Trophy, Headphones, MessageSquare } from "lucide-react";

const DEFAULT_ITEMS = [
  { to: "/", label: "בית", icon: Home },
  { to: "/goal", label: "יעד", icon: Target },
  { to: "/league", label: "ליגה", icon: Trophy },
  { to: "/hq", label: 'חמ"ל', icon: Headphones },
  { to: "/messages", label: "הודעות", icon: MessageSquare },
];

export default function BottomNav({ items = DEFAULT_ITEMS }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className={cn("flex items-center justify-around h-16 max-w-md mx-auto px-1", items.length > 5 && "max-w-lg")}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/manager" || to === "/admin" || to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[9px] font-medium leading-none">{label}</span>
                {isActive && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}