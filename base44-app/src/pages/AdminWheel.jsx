import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Search, ChevronDown, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ProgressRing from "@/components/ProgressRing";
import NudgeModal from "@/components/NudgeModal";
import ParticipantModal from "@/components/ParticipantModal";
import UserAvatar from "@/components/UserAvatar";

export default function AdminWheel() {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [nudgeTarget, setNudgeTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adminUserId, setAdminUserId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, g, me] = await Promise.all([
          apiClient.entities.Member.list(),
          apiClient.entities.Group.list(),
          apiClient.auth.me(),
        ]);
        setMembers(m);
        setGroups(g);
        setAdminUserId(me.id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const filteredMembers = members.filter((m) => {
    if (
      query &&
      !m.name?.toLowerCase().includes(query.toLowerCase()) &&
      !m.group_name?.toLowerCase().includes(query.toLowerCase())
    ) {
      return false;
    }
    if (filter === "low" && (m.progress || 0) >= 40) return false;
    if (filter === "mid" && ((m.progress || 0) < 40 || (m.progress || 0) > 70)) return false;
    if (filter === "high" && (m.progress || 0) <= 70) return false;
    if (filter === "inactive" && m.status !== "לא פעיל") return false;
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור אדמין" title="ביקורת הגלגל" subtitle="ביקורת על הגלגל של כל המשתמשים במערכת" />

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש קבוצות ומשתתפות..."
            className="w-full bg-input rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {[
            { k: "all", l: "הכל" },
            { k: "low", l: "מתחת ל-40%" },
            { k: "mid", l: "40%-70%" },
            { k: "high", l: "מעל 70%" },
            { k: "inactive", l: "לא פעילים" },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {groups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו קבוצות תואמות</p>
        )}
        {groups.map((g) => {
          const gMembers = filteredMembers.filter((m) => m.group_name === g.name);
          const isOpen = expanded === g.id;
          return (
            <div key={g.id} className="card-lux">
              <button type="button" onClick={() => setExpanded(isOpen ? null : g.id)} className="w-full p-3 flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    g.status === "on_track" ? "bg-green-500" : g.status === "needs_attention" ? "bg-orange-400" : "bg-red-500"
                  }`}
                />
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.target} · {g.gender === "female" ? "נשים" : "גברים"} · {g.participant_count}/5
                  </p>
                </div>
                <ProgressRing progress={g.avg_progress || 0} size={32} stroke={3} />
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {gMembers.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">אין חברים תואמים</p>
                  )}
                  {gMembers.map((m) => (
                    <div key={m.id} className="p-3 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex items-center gap-3 flex-1 min-w-0 text-right"
                        onClick={() => setSelected(m)}
                      >
                        <UserAvatar src={m.avatar_url} name={m.name} className="w-8 h-8 ring-1 ring-border" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {m.status} · {m.xp || 0} XP · רצף {m.streak || 0}
                          </p>
                        </div>
                        <ProgressRing progress={m.progress || 0} size={30} stroke={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNudgeTarget(m)}
                        className="p-2 rounded-lg bg-primary/15 text-primary"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nudgeTarget && (
        <NudgeModal
          member={nudgeTarget}
          sourceName="סופר-אדמין"
          sourceUserId={adminUserId}
          onClose={() => setNudgeTarget(null)}
        />
      )}
      {selected && (
        <ParticipantModal
          member={selected}
          onClose={() => setSelected(null)}
          sourceName="סופר-אדמין"
          sourceUserId={adminUserId}
          readOnly={false}
        />
      )}
    </div>
  );
}
