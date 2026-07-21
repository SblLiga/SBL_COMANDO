import React from "react";
import { cn } from "@/lib/utils";

export default function KpiCard({ icon: Icon, value, label, accent = false, className }) {
  return (
    <div
      className={cn(
        "rounded-xl p-3 flex flex-col items-center justify-center text-center",
        accent ? "card-gold-rim glow-gold" : "card-lux",
        className
      )}
    >
      {Icon && <Icon className={cn("w-5 h-5 mb-1", accent ? "text-primary" : "text-primary/70")} />}
      <span className={cn("font-display font-bold leading-none", accent ? "text-2xl gold-text" : "text-xl")}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground leading-tight mt-1 text-center">{label}</span>
    </div>
  );
}