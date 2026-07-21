import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { Home, CircleDot, Trophy, UserCog, FileText, Megaphone } from "lucide-react";

const items = [
  { to: "/admin", label: "בית", icon: Home },
  { to: "/admin/wheel", label: "הגלגל", icon: CircleDot },
  { to: "/admin/league", label: "ליגה", icon: Trophy },
  { to: "/admin/managers", label: "מנהלות", icon: UserCog },
  { to: "/admin/reports", label: "דוחות", icon: FileText },
  { to: "/admin/alerts", label: "עדכונים", icon: Megaphone },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="max-w-md lg:max-w-xl mx-auto min-h-screen">
        <Outlet />
      </main>
      <BottomNav items={items} />
    </div>
  );
}