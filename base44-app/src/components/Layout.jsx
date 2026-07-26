import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      <Header />
      <main className="max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl mx-auto min-h-screen px-4 lg:px-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
