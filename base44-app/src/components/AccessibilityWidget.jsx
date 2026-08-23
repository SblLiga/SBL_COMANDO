import React, { useEffect, useId, useRef, useState } from "react";
import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";

const STORAGE_KEY = "sbl_a11y_settings";

const DEFAULTS = {
  textStep: 0,
  contrast: false,
  light: false,
  greyscale: false,
  highlightLinks: false,
};

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function applyToDocument(settings) {
  const root = document.documentElement;
  root.classList.toggle("a11y-contrast", Boolean(settings.contrast));
  root.classList.toggle("a11y-light", Boolean(settings.light));
  root.classList.toggle("a11y-greyscale", Boolean(settings.greyscale));
  root.classList.toggle("a11y-links", Boolean(settings.highlightLinks));
  const sizes = [null, "106%", "112%", "120%", "130%"];
  const step = Math.min(4, Math.max(0, Number(settings.textStep) || 0));
  if (step === 0) root.style.removeProperty("font-size");
  else root.style.fontSize = sizes[step];
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(readSettings);
  const panelId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    applyToDocument(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  const Toggle = ({ label, checked, onChange }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full text-right rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 ${
        checked ? "gold-bg text-black font-bold" : "bg-muted text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="text-[11px]">{checked ? "פועל" : "כבוי"}</span>
    </button>
  );

  return (
    <div className="fixed bottom-28 left-3 z-[70] sm:bottom-6" dir="rtl">
      <button
        type="button"
        aria-label="הגדרות נגישות"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full gold-gradient text-black flex items-center justify-center shadow-lg ring-2 ring-background"
      >
        <Accessibility className="w-6 h-6" aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label="תפריט נגישות"
          className="absolute bottom-14 left-0 w-64 card-gold-rim p-3 space-y-2 shadow-xl"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold gold-text">הגדרות נגישות</p>
            <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between bg-muted rounded-lg px-2 py-2">
            <span className="text-sm">גודל טקסט</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="הקטנת טקסט"
                className="w-8 h-8 rounded bg-card flex items-center justify-center"
                onClick={() => update({ textStep: Math.max(0, settings.textStep - 1) })}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs w-6 text-center">{settings.textStep}</span>
              <button
                type="button"
                aria-label="הגדלת טקסט"
                className="w-8 h-8 rounded bg-card flex items-center justify-center"
                onClick={() => update({ textStep: Math.min(4, settings.textStep + 1) })}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <Toggle
            label="ניגודיות גבוהה"
            checked={settings.contrast}
            onChange={(contrast) => update({ contrast })}
          />
          <Toggle
            label="מצב בהיר"
            checked={settings.light}
            onChange={(light) => update({ light })}
          />
          <Toggle
            label="גווני אפור"
            checked={settings.greyscale}
            onChange={(greyscale) => update({ greyscale })}
          />
          <Toggle
            label="הדגשת קישורים"
            checked={settings.highlightLinks}
            onChange={(highlightLinks) => update({ highlightLinks })}
          />

          <button
            type="button"
            onClick={() => setSettings({ ...DEFAULTS })}
            className="w-full rounded-lg px-3 py-2 text-sm bg-card border border-border flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            איפוס
          </button>
        </div>
      )}
    </div>
  );
}
