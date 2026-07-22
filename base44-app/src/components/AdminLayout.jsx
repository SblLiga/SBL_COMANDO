import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { LayoutDashboard, Target, Trophy, Users, Flag, Bell } from "lucide-react";

const items = [
  { to: "/admin", label: "בית", icon: LayoutDashboard },
  { to: "/admin/wheel", label: "הגלגל", icon: Target },
  { to: "/admin/league", label: "ליגה", icon: Trophy },
  { to: "/admin/managers", label: "מנהלות", icon: Users },
  { to: "/admin/reports", label: "דוחות", icon: Flag },
  { to: "/admin/alerts", label: "עדכונים", icon: Bell },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header hideUser />
      <main className="max-w-md lg:max-w-3xl mx-auto min-h-screen">
        <Outlet />
      </main>
      <BottomNav items={items} />
    </div>
  );
}
