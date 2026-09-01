import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import ManagerGoalSelection from "@/components/ManagerGoalSelection";
import { Home, Target, Users, UserCog, Trophy, Calendar, Bell } from "lucide-react";

const items = [
  { to: "/manager", label: "בית", icon: Home },
  { to: "/manager/goal", label: "היעד שלי", icon: Target },
  { to: "/manager/group", label: "הקבוצה", icon: Users },
  { to: "/manager/managers", label: "מנהלים", icon: UserCog },
  { to: "/manager/league", label: "ליגה", icon: Trophy },
  { to: "/manager/meeting", label: "ישיבה", icon: Calendar },
  { to: "/manager/alerts", label: "התראות", icon: Bell },
];

export default function ManagerLayout() {
  const [gate, setGate] = useState({ locked: true, ready: false });

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      {gate.ready && !gate.locked && (
        <>
          <main className="max-w-md lg:max-w-xl mx-auto min-h-screen">
            <Outlet />
          </main>
          <BottomNav items={items} />
        </>
      )}
      <ManagerGoalSelection onGateState={setGate} />
    </div>
  );
}
