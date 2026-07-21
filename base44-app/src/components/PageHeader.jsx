import React from "react";

export default function PageHeader({ badge, title, subtitle, action }) {
  return (
    <div className="pt-3 pb-1 flex items-start justify-between gap-3">
      <div>
        {badge && (
          <span className="text-[10px] text-primary font-bold tracking-wide uppercase">{badge}</span>
        )}
        <h1 className="font-display text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}