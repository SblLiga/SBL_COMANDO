import React, { useState, useEffect, useRef } from "react";
import { X, Pause, Play, FileText, Clock } from "lucide-react";

export const AGENDA = [
  { title: "משתתפות - שיח חופשי", minutes: 5 },
  { title: "הצגה עצמית", minutes: 5 },
  { title: "יעדים שהושגו", minutes: 10 },
  { title: "אבני דרך / חסמים", minutes: 20 },
  { title: "שיתופי פעולה", minutes: 10 },
  { title: "נושא לדון", minutes: 30 },
];

export default function LiveMeeting({ groupName, onEnd }) {
  const [section, setSection] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sectionLeft, setSectionLeft] = useState(AGENDA[0].minutes * 60);
  const [globalLeft, setGlobalLeft] = useState(90 * 60);
  const [reports, setReports] = useState(AGENDA.map(() => ""));
  const [showTimeout, setShowTimeout] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setSectionLeft((s) => (s > 0 ? s - 1 : 0));
      setGlobalLeft((g) => (g > 0 ? g - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [paused, section]);

  // When a section countdown hits 0, freeze timers and show un-skippable modal
  useEffect(() => {
    if (sectionLeft === 0 && globalLeft > 0 && !showTimeout) {
      setPaused(true);
      setShowTimeout(true);
    }
  }, [sectionLeft, globalLeft, showTimeout]);

  const nextSection = () => {
    if (section < AGENDA.length - 1) {
      const ns = section + 1;
      setSection(ns);
      setSectionLeft(AGENDA[ns].minutes * 60);
      setPaused(false);
    }
  };

  const advanceFromTimeout = () => {
    setShowTimeout(false);
    if (section < AGENDA.length - 1) {
      nextSection();
    } else {
      onEnd(reports);
    }
  };

  const fmt = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const sectionPct = ((AGENDA[section].minutes * 60 - sectionLeft) / (AGENDA[section].minutes * 60)) * 100;
  const globalPct = ((90 * 60 - globalLeft) / (90 * 60)) * 100;
  const isLast = section >= AGENDA.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="text-[10px] text-primary font-bold">פגישה חיה · {groupName}</p>
          <p className="text-sm font-bold">חלק {section + 1} מתוך {AGENDA.length} — {AGENDA[section].title}</p>
        </div>
        <button onClick={() => onEnd(reports)} className="p-2 rounded-lg bg-muted">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* step bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
        {AGENDA.map((a, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < section ? "gold-bg" : i === section ? "gold-gradient" : "bg-muted"}`} />
        ))}
      </div>

      {/* timers */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 overflow-y-auto">
        <div className="relative w-56 h-56">
          <svg width="224" height="224" className="-rotate-90">
            <circle cx="112" cy="112" r="100" fill="none" stroke="hsl(240 6% 14%)" strokeWidth="10" />
            <circle
              cx="112" cy="112" r="100" fill="none" stroke="url(#liveGrad)" strokeWidth="10"
              strokeDasharray={2 * Math.PI * 100}
              strokeDashoffset={2 * Math.PI * 100 - (sectionPct / 100) * 2 * Math.PI * 100}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="liveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(38 45% 72%)" />
                <stop offset="100%" stopColor="hsl(32 30% 50%)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="font-display text-4xl font-bold gold-text">{fmt(sectionLeft)}</span>
            <span className="text-xs text-muted-foreground mt-1">{AGENDA[section].title}</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">טיימר כללי (90 דק׳)</span>
            <span className={`font-bold ${globalLeft < 600 ? "text-destructive" : "gold-text"}`}>{fmt(globalLeft)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full gold-gradient rounded-full transition-all" style={{ width: `${globalPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setPaused(!paused)} className="w-14 h-14 rounded-full card-gold-rim flex items-center justify-center">
            {paused ? <Play className="w-6 h-6 text-primary" /> : <Pause className="w-6 h-6 text-primary" />}
          </button>
          {!isLast && (
            <button onClick={nextSection} className="gold-bg text-black rounded-full px-6 py-3 font-bold text-sm">
              סעיף הבא ←
            </button>
          )}
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">דוח סעיף: {AGENDA[section].title}</span>
          </div>
          <textarea
            value={reports[section]}
            onChange={(e) => {
              const next = [...reports];
              next[section] = e.target.value;
              setReports(next);
            }}
            placeholder="כתוב סיכום לסעיף זה..."
            className="w-full bg-input rounded-xl p-3 text-sm h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* MANDATORY timeout intercept modal */}
      {showTimeout && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6">
          <div className="card-gold-rim p-6 text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="font-display text-xl font-bold mb-1">נגמר הזמן!</h2>
            <p className="text-sm text-muted-foreground mb-5">תעברו לחלק הבא!</p>
            <button onClick={advanceFromTimeout} className="w-full gold-gradient text-black font-bold rounded-xl py-3 text-sm">
              {isLast ? "סיום פגישה" : `עבור ל${AGENDA[section + 1].title} ←`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}