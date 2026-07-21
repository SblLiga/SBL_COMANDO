import React, { useState } from "react";
import { Lock, Shuffle } from "lucide-react";

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const truncate = (str, max = 11) => (str && str.length > max ? str.slice(0, max - 1) + "…" : str || "");

function SmartWheel({ tasks = [], onToggle, onSwap, size = 340, hidden = false }) {
  const [swapMode, setSwapMode] = useState(false);
  const [swapFrom, setSwapFrom] = useState(null);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const labelR = r + 18;
  const n = tasks.length || 1;
  const slice = 360 / n;
  const completed = tasks.filter((t) => t.is_completed).length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const handleArcClick = (task, i) => {
    if (swapMode && onSwap) {
      if (swapFrom === null) {
        setSwapFrom(i);
      } else if (swapFrom === i) {
        setSwapFrom(null);
      } else {
        onSwap(swapFrom, i);
        setSwapFrom(null);
        setSwapMode(false);
      }
    } else {
      onToggle && onToggle(task, i);
    }
  };

  if (hidden) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="rounded-full border-2 border-primary/30 bg-card flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Lock className="w-10 h-10 text-primary/50" />
            <span className="text-sm">יעד חסוי</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(38 45% 72%)" />
              <stop offset="50%" stopColor="hsl(35 37% 64%)" />
              <stop offset="100%" stopColor="hsl(32 30% 50%)" />
            </linearGradient>
            <filter id="goldGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(0 0% 12%)" strokeWidth={22} />
          {tasks.map((task, i) => {
            const start = i * slice;
            const end = start + slice;
            const midAngle = start + slice / 2;
            const gap = Math.min(3, slice * 0.08);
            const numPos = polarToCartesian(cx, cy, r, midAngle);
            const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
            const isSelected = swapFrom === i;
            return (
              <g key={task.id || i}>
                <path
                  d={arcPath(cx, cy, r, start + gap / 2, end - gap / 2)}
                  fill="none"
                  stroke={
                    task.is_completed
                      ? "url(#goldGrad)"
                      : isSelected
                      ? "hsl(38 49% 38%)"
                      : "hsl(0 0% 18%)"
                  }
                  strokeWidth={22}
                  strokeLinecap="round"
                  onClick={() => handleArcClick(task, i)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    filter: task.is_completed
                      ? "drop-shadow(0 0 6px hsl(35 37% 64% / 0.5))"
                      : isSelected
                      ? "drop-shadow(0 0 8px hsl(38 49% 50% / 0.6))"
                      : "none",
                  }}
                />
                <text
                  x={numPos.x}
                  y={numPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none"
                  fill={task.is_completed ? "#000" : "hsl(0 0% 55%)"}
                  fontSize="12"
                  fontWeight="700"
                >
                  {i + 1}
                </text>
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none"
                  fill={task.is_completed ? "hsl(38 49% 70%)" : "hsl(0 0% 60%)"}
                  fontSize="9"
                >
                  {truncate(task.title, 11)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-5xl font-bold gold-text text-shadow-gold">{pct}%</span>
          <span className="text-xs text-muted-foreground mt-1">
            {completed}/{tasks.length} משימות
          </span>
        </div>
      </div>

      {onSwap && tasks.length > 1 && (
        <button
          onClick={() => {
            setSwapMode(!swapMode);
            setSwapFrom(null);
          }}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
            swapMode ? "gold-bg text-black font-bold" : "bg-muted text-muted-foreground"
          }`}
        >
          <Shuffle className="w-3.5 h-3.5" />
          {swapMode
            ? swapFrom === null
              ? "בחר/י תחום ראשון להחלפה"
              : "בחר/י תחום שני להחלפה"
            : "מצב החלפת תחומים"}
        </button>
      )}
    </div>
  );
}

export default React.memo(SmartWheel);