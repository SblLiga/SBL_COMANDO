import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="max-w-md lg:max-w-xl mx-auto min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}