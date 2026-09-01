import React from "react";
import { Link } from "react-router-dom";

const LOGO_URL = "/logo.png";

/**
 * Auth shell. footerLink = { to, label, prompt } makes the colored CTA a real clickable Link.
 */
export default function AuthLayout({ title, subtitle, footerLink, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative z-0">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <img
            src={LOGO_URL}
            alt="שולי בן לולו"
            className="w-16 h-16 mx-auto mb-4 rounded-full ring-1 ring-primary/40 object-cover bg-black"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">{children}</div>
        {(footerLink || footer) && (
          <p className="text-center text-sm text-muted-foreground mt-6 relative z-20">
            {footerLink ? (
              <>
                {footerLink.prompt}{" "}
                <Link
                  to={footerLink.to}
                  className="text-primary font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer"
                >
                  {footerLink.label}
                </Link>
              </>
            ) : (
              footer
            )}
          </p>
        )}
        <p className="text-center mt-4 relative z-20">
          <Link to="/privacy" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary">
            מדיניות פרטיות
          </Link>
        </p>
      </div>
    </div>
  );
}
