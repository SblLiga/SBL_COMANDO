import React from "react";

const LOGO_URL = "/logo.png";

export default function AuthLayout({ icon: _Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src={LOGO_URL}
            alt="שולי בן לולו"
            className="w-16 h-16 mx-auto mb-4 rounded-full ring-1 ring-primary/40 object-cover bg-black"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
