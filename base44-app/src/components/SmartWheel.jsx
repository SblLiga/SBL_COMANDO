import React, { useState } from "react";
import { Lock, Shuffle } from "lucide-react";

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const wedgePath = (cx, cy, r, startAngle, endAngle, innerR = 0) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  if (innerR > 0) {
    const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} L ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y} Z`;
  }
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
};

function SmartWheel({ tasks = [], onToggle, onSwap, size = 340, hidden = false, goalTitle = "" }) {
  const [swapMode, setSwapMode] = useState(false);
  const [swapFrom, setSwapFrom] = useState(null);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 38;
  const outerRingR = r + 14;
  const innerHubR = r * 0.32;
  const labelR = r * 0.62;
  const numR = r - 14;
  const n = tasks.length || 1;
  const slice = 360 / n;
  const completed = tasks.filter((t) => t.is_completed).length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const labelFontSize = n > 6 ? 9 : n > 4 ? 10 : 11;
  const numFontSize = 13;
  const labelWidth = n > 5 ? 70 : 90;

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
        <div className="rounded-full border-2 border-primary/30 bg-card flex items-center justify-center" style={{ width: size, height: size }}>
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
        <svg width={size} height={size} style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}>
          <defs>
            <radialGradient id="segGold" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="hsl(38 55% 66%)" />
              <stop offset="70%" stopColor="hsl(38 49% 56%)" />
              <stop offset="100%" stopColor="hsl(32 35% 44%)" />
            </radialGradient>
            <radialGradient id="segDark" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="hsl(0 0% 22%)" />
              <stop offset="70%" stopColor="hsl(0 0% 16%)" />
              <stop offset="100%" stopColor="hsl(0 0% 10%)" />
            </radialGradient>
            <radialGradient id="segSelected" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="hsl(38 45% 48%)" />
              <stop offset="70%" stopColor="hsl(38 49% 40%)" />
              <stop offset="100%" stopColor="hsl(32 35% 30%)" />
            </radialGradient>
            <radialGradient id="hubGrad" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="hsl(0 0% 20%)" />
              <stop offset="100%" stopColor="hsl(0 0% 10%)" />
            </radialGradient>
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer gold ring */}
          <circle cx={cx} cy={cy} r={outerRingR} fill="none" stroke="hsl(38 49% 56%)" strokeWidth={1.5} opacity={0.6} />
          <circle cx={cx} cy={cy} r={outerRingR - 4} fill="none" stroke="hsl(38 49% 56%)" strokeWidth={0.8} opacity={0.3} />

          {/* Background disc */}
          <circle cx={cx} cy={cy} r={r + 2} fill="hsl(0 0% 8%)" />

          {/* Pie segments */}
          {tasks.map((task, i) => {
            const start = i * slice;
            const end = start + slice;
            const midAngle = start + slice / 2;
            const gap = Math.min(2.5, slice * 0.06);
            const numPos = polarToCartesian(cx, cy, numR, midAngle);
            const isSelected = swapFrom === i;
            const fill = task.is_completed ? "url(#segGold)" : isSelected ? "url(#segSelected)" : "url(#segDark)";
            return (
              <g key={task.id || i}>
                <path
                  d={wedgePath(cx, cy, r, start + gap / 2, end - gap / 2)}
                  fill={fill}
                  stroke="hsl(0 0% 6%)"
                  strokeWidth={1.5}
                  onClick={() => handleArcClick(task, i)}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    filter: task.is_completed ? "drop-shadow(0 0 5px hsl(38 49% 56% / 0.4))" : isSelected ? "drop-shadow(0 0 6px hsl(38 49% 50% / 0.5))" : "none",
                  }}
                />
                <text
                  x={numPos.x}
                  y={numPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none"
                  fill={task.is_completed ? "hsl(0 0% 8%)" : "hsl(0 0% 62%)"}
                  fontSize={numFontSize}
                  fontWeight="800"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Central hub */}
          <circle cx={cx} cy={cy} r={innerHubR + 6} fill="hsl(0 0% 6%)" />
          <circle cx={cx} cy={cy} r={innerHubR} fill="url(#hubGrad)" stroke="hsl(0 0% 16%)" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={innerHubR} fill="none" stroke="hsl(38 49% 56%)" strokeWidth={0.6} opacity={0.25} />
        </svg>

        {/* HTML labels positioned within slices */}
        {tasks.map((task, i) => {
          const start = i * slice;
          const midAngle = start + slice / 2;
          const labelPos = polarToCartesian(cx, cy, labelR, midAngle);
          return (
            <div
              key={`label-${task.id || i}`}
              className="absolute pointer-events-none select-none text-center leading-tight"
              style={{
                left: labelPos.x,
                top: labelPos.y,
                transform: "translate(-50%, -50%)",
                width: labelWidth,
                fontSize: labelFontSize,
                fontWeight: 600,
                color: task.is_completed ? "hsl(0 0% 10%)" : "hsl(0 0% 68%)",
              }}
            >
              {task.title}
            </div>
          );
        })}

        {/* Center: percentage + goal title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-16">
          <span className="font-display text-3xl sm:text-4xl font-bold gold-text text-shadow-gold leading-none">{pct}%</span>
          {goalTitle && (
            <span className="text-[8px] sm:text-[9px] text-primary font-medium mt-0.5 text-center leading-tight max-w-[45%] truncate">
              {goalTitle}
            </span>
          )}
          <span className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{completed}/{tasks.length}</span>
        </div>
      </div>

      {onSwap && tasks.length > 1 && (
        <button
          onClick={() => { setSwapMode(!swapMode); setSwapFrom(null); }}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${swapMode ? "gold-bg text-black font-bold glow-gold" : "bg-muted text-muted-foreground"}`}
        >
          <Shuffle className="w-3.5 h-3.5" />
          {swapMode
            ? swapFrom === null
              ? "בחר/י תחום ראשון להחלפה בגלגל"
              : "בחר/י תחום שני להחלפה בגלגל"
            : "מצב החלפת תחומים בגלגל"}
        </button>
      )}
    </div>
  );
}

export default React.memo(SmartWheel);
