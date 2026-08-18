import React from "react";
import { Link, Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { LayoutDashboard, CircleDot, Target, Trophy, Users, Flag, Bell, UserRound } from "lucide-react";

const items = [
  { to: "/admin", label: "בית", icon: LayoutDashboard },
  { to: "/admin/my-goal", label: "היעד שלי", icon: CircleDot },
  { to: "/admin/wheel", label: "הגלגל", icon: Target },
  { to: "/admin/league", label: "ליגה", icon: Trophy },
  { to: "/admin/managers", label: "מנהלות", icon: Users },
  { to: "/admin/reports", label: "דוחות", icon: Flag },
  { to: "/admin/alerts", label: "עדכונים", icon: Bell },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative">
        {/* Spec: admin chrome stays identity-light; profile + logout live on /profile */}
        <Header hideUser />
        <Link
          to="/profile"
          aria-label="פרופיל"
          className="absolute left-3 top-3 z-50 w-9 h-9 rounded-full bg-muted/80 border border-border flex items-center justify-center hover:bg-accent"
        >
          <UserRound className="w-4 h-4 text-primary" />
        </Link>
      </div>
      <main className="max-w-md lg:max-w-3xl mx-auto min-h-screen">
        <Outlet />
      </main>
      <BottomNav items={items} />
    </div>
  );
}
