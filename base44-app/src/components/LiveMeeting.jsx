import React, { useState, useEffect, useRef } from "react";
import { X, Pause, Play, Clock, Pencil } from "lucide-react";

export const AGENDA = [
  { title: "משתתפות-שיח חופשי", minutes: 5 },
  { title: "הצגה עצמית", minutes: 5 },
  { title: "יעדים שהושגו", minutes: 10 },
  { title: "אבני דרך/חסמים", minutes: 20 },
  { title: "שיתופי פעולה", minutes: 10 },
  { title: "נושא לדון", minutes: 30 },
];

export default function LiveMeeting({ groupName, onEnd, onDraftSave }) {
  const [section, setSection] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sectionLeft, setSectionLeft] = useState(AGENDA[0].minutes * 60);
  const [globalLeft, setGlobalLeft] = useState(90 * 60);
  const [reports, setReports] = useState(AGENDA.map(() => ""));
  const [showTimeout, setShowTimeout] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (paused || showReport) return;
    intervalRef.current = setInterval(() => {
      setSectionLeft((s) => (s > 0 ? s - 1 : 0));
      setGlobalLeft((g) => (g > 0 ? g - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [paused, section, showReport]);

  useEffect(() => {
    if (sectionLeft === 0 && globalLeft > 0 && !showTimeout) {
      setPaused(true);
      setShowTimeout(true);
    }
  }, [sectionLeft, globalLeft, showTimeout]);

  useEffect(() => {
    if (globalLeft === 0) {
      onEnd(reports);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when timer hits zero
  }, [globalLeft]);

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
    if (section < AGENDA.length - 1) nextSection();
    else setShowEndConfirm(true);
  };

  const fmt = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const sectionPct = ((AGENDA[section].minutes * 60 - sectionLeft) / (AGENDA[section].minutes * 60)) * 100;
  const globalPct = ((90 * 60 - globalLeft) / (90 * 60)) * 100;
  const isLast = section >= AGENDA.length - 1;

  const persistDraftAndClose = () => {
    onDraftSave?.(reports);
    setShowReport(false);
  };

  if (showReport) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="text-[10px] text-primary font-bold">פגישת קומנדו</p>
            <h2 className="text-sm font-bold">כתיבת דוח / סיכום פגישה</h2>
          </div>
          <button type="button" onClick={persistDraftAndClose} className="p-2 rounded-lg bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {AGENDA.map((a, i) => (
            <div key={a.title} className="space-y-1">
              <label className="text-xs font-bold">{i + 1}. {a.title}</label>
              <textarea
                value={reports[i]}
                onChange={(e) => {
                  const next = [...reports];
                  next[i] = e.target.value;
                  setReports(next);
                }}
                placeholder="כתבו סיכום עבור נושא זה..."
                className="w-full bg-input rounded-xl p-3 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={persistDraftAndClose}
            className="w-full gold-bg text-black rounded-xl py-3 font-bold text-sm"
          >
            שמור דוח
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="text-[10px] text-primary font-bold">פגישת קומנדו · חלק {section + 1} מתוך 6</p>
          <p className="text-sm font-bold">{AGENDA[section].title}</p>
          <p className="text-[10px] text-muted-foreground">{groupName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPaused(true);
              setShowReport(true);
            }}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-primary/15 text-primary font-medium"
          >
            <Pencil className="w-3.5 h-3.5" /> כתוב דוח
          </button>
          <button type="button" onClick={() => setShowEndConfirm(true)} className="p-2 rounded-lg bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
        {AGENDA.map((a, i) => (
          <div key={a.title} className={`h-1.5 flex-1 rounded-full ${i < section ? "gold-bg" : i === section ? "gold-gradient" : "bg-muted"}`} />
        ))}
      </div>

      <div className="px-4 py-2 border-b border-border space-y-1">
        {AGENDA.map((a, i) => (
          <div key={a.title} className={`text-[11px] flex justify-between ${i === section ? "font-bold text-primary" : "text-muted-foreground"}`}>
            <span>{i + 1}. {a.title}</span>
            <span>{a.minutes} דק׳</span>
          </div>
        ))}
      </div>

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
            <span className="text-xs text-muted-foreground mt-1">מתוך {AGENDA[section].minutes} דקות</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">זמן כולל · נותר מתוך 90 דק׳</span>
            <span className={`font-bold ${globalLeft < 600 ? "text-destructive" : "gold-text"}`}>{fmt(globalLeft)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full gold-gradient rounded-full transition-all" style={{ width: `${globalPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPaused(!paused)} className="w-14 h-14 rounded-full card-gold-rim flex items-center justify-center">
            {paused ? <Play className="w-6 h-6 text-primary" /> : <Pause className="w-6 h-6 text-primary" />}
          </button>
          {!isLast && (
            <button type="button" onClick={nextSection} className="gold-bg text-black rounded-full px-6 py-3 font-bold text-sm">
              דלגי לחלק הבא ←
            </button>
          )}
        </div>
      </div>

      {showTimeout && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6">
          <div className="card-gold-rim p-6 text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="font-display text-xl font-bold mb-1">נגמר הזמן!</h2>
            <p className="text-sm text-muted-foreground mb-5">תעברו לחלק הבא!</p>
            <button type="button" onClick={advanceFromTimeout} className="w-full gold-gradient text-black font-bold rounded-xl py-3 text-sm">
              {isLast ? "סיום פגישה" : `עבור ל "${AGENDA[section + 1].title}"`}
            </button>
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6">
          <div className="card-gold-rim p-6 text-center max-w-sm w-full">
            <h2 className="font-display text-xl font-bold mb-1">האם ברצונך לסיים את הפגישה?</h2>
            <p className="text-sm text-muted-foreground mb-5">הדוח יישמר בסיכום הישיבה האחרונה</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEndConfirm(false)} className="flex-1 bg-muted rounded-xl py-3 text-sm font-medium">ביטול</button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEnd(reports);
                }}
                className="flex-1 gold-bg text-black rounded-xl py-3 text-sm font-bold"
              >
                אישור ושמירת דוח
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
