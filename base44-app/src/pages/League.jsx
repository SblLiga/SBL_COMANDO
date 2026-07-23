import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Search, Flame, Crown, Medal, Lock } from "lucide-react";
import ProgressRing from "@/components/ProgressRing";
import ParticipantModal from "@/components/ParticipantModal";
import UserAvatar from "@/components/UserAvatar";

const statusDot = {
  "בעקבות": "bg-green-500",
  "דרושה התייחסות": "bg-orange-400",
  קריטי: "bg-red-500",
  "לא פעיל": "bg-gray-500",
};

export default function League({ zoneBadge = "אזור משתמש", readOnly = true }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, u] = await Promise.all([
          apiClient.entities.Member.list(),
          apiClient.auth.me().catch(() => null),
        ]);
        setMembers(m.filter((row) => row.role === "user"));
        if (u) setCurrentUserId(u.id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const isMe = (m) => currentUserId && m.user_id === currentUserId;
  const filtered = sorted.filter(
    (m) =>
      m.name?.toLowerCase().includes(query.toLowerCase()) ||
      m.group_name?.toLowerCase().includes(query.toLowerCase())
  );
  const podium = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const podiumOrder = [1, 0, 2];

  return (
    <div className="p-4 space-y-5 pb-4">
      <div className="pt-2">
        <p className="text-xs text-muted-foreground">{zoneBadge}</p>
        <h1 className="font-display text-2xl font-bold gold-text">ליגה</h1>
        <p className="text-sm text-muted-foreground">חיפוש משתתפת או קבוצה…</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש משתתפת או קבוצה…"
          className="w-full bg-input rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {podium.length >= 3 && (
        <div className="flex items-end justify-center gap-3 py-6">
          {podiumOrder.map((idx) => {
            const m = podium[idx];
            if (!m) return null;
            const place = idx + 1;
            const isGold = place === 1;
            const height = isGold ? "h-32" : "h-24";
            const medalColor = place === 1 ? "text-black" : place === 2 ? "text-gray-200" : "text-amber-300";
            const podiumBg = place === 1 ? "gold-gradient" : place === 2 ? "bg-secondary" : "bg-accent";
            const Icon = place === 1 ? Crown : Medal;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
              >
                <div className="relative">
                  <UserAvatar
                    src={m.avatar_url}
                    name={m.name}
                    className={isGold ? "w-16 h-16 ring-2 ring-primary glow-gold" : "w-12 h-12 ring-1 ring-border"}
                  />
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${isGold ? "w-7 h-7" : "w-6 h-6"} rounded-full gold-gradient flex items-center justify-center text-black font-bold text-xs ring-2 ring-background`}>
                    {place}
                  </div>
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-bold truncate">{m.name}</p>
                  <p className="text-[11px] gold-text font-bold">{m.xp || 0} XP</p>
                </div>
                <div className={`w-full ${height} ${podiumBg} rounded-t-xl flex items-center justify-center border border-border`}>
                  <Icon className={`w-7 h-7 ${medalColor}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {rest.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m)}
            className={`w-full text-right card-lux p-3 flex items-center gap-3 ${isMe(m) ? "border-primary/50" : ""}`}
          >
            <span className="font-display text-lg font-bold text-muted-foreground w-6 text-center">{i + 4}</span>
            <UserAvatar src={m.avatar_url} name={m.name} className="w-9 h-9 ring-1 ring-border" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name} {isMe(m) && <span className="text-primary text-[10px]">(את/ה)</span>}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m.group_name}</p>
            </div>
            <div className={`w-2 h-2 rounded-full ${statusDot[m.status] || "bg-gray-500"}`} />
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <Flame className="w-3.5 h-3.5" />
              {m.streak || 0}
            </div>
            <span className="text-xs gold-text font-bold w-12 text-left">{m.xp || 0}</span>
            {m.goal_hidden ? (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" title="יעד חסוי">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            ) : (
              <ProgressRing progress={m.progress || 0} size={32} stroke={3} />
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">אין כרטיסים תואמים</p>
        )}
      </div>

      {selected && (
        <ParticipantModal
          member={selected}
          onClose={() => setSelected(null)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
