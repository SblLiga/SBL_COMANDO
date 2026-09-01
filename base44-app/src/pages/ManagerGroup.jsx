import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Flame, Zap, Users, Lock } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import ProgressRing from "@/components/ProgressRing";
import ParticipantModal from "@/components/ParticipantModal";
import NudgeModal from "@/components/NudgeModal";
import { loadManagerGroupMembers, resolveManagerOwnedGroup } from "@/lib/managerGroup";

const statusColor = {
  "בעקבות": "bg-green-500",
  "דרושה התייחסות": "bg-orange-400",
  קריטי: "bg-red-500",
  "לא פעיל": "bg-gray-500",
};

const groupStatusBadge = {
  on_track: { label: "בעקבות", cls: "bg-green-500/15 text-green-500" },
  needs_attention: { label: "דרושה התייחסות", cls: "bg-orange-400/15 text-orange-400" },
  critical: { label: "קריטי", cls: "bg-red-500/15 text-red-500" },
};

export default function ManagerGroup() {
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nudgeTarget, setNudgeTarget] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        setCurrentUserId(user.id);
        const { group: owned, member } = await resolveManagerOwnedGroup(user);
        setCurrentMember(member);
        setGroup(owned);
        setMembers(owned ? await loadManagerGroupMembers(owned) : []);
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

  const avg = members.length ? Math.round(members.reduce((s, m) => s + (m.progress || 0), 0) / members.length) : 0;
  const redLights = members.filter((m) => m.status === "קריטי" || m.status === "לא פעיל");
  const groupName = group?.name || "הקבוצה שלי";
  const target = group?.target || members[0]?.target || "—";
  const badge = groupStatusBadge[group?.status] || groupStatusBadge.on_track;

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור מנהל" title="הקבוצה שלי" subtitle={`${members.length} לוחמים בשטח`} />

      <div className="card-gold-rim p-5">
        <div className="flex items-center gap-4">
          <ProgressRing progress={avg} size={64} stroke={5} showText />
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold truncate">{groupName}</h2>
            <p className="text-xs text-muted-foreground truncate">{target}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {members.length} חברים
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard value={`${avg}%`} label="צביעה ממוצעת" accent />
        <KpiCard icon={Flame} value={redLights.length} label="נורות אדומות" className="border-destructive/30" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold">חברי הקבוצה ({members.length})</h3>
        {members.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">אין חברי קבוצה להצגה</p>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            onClick={() => setSelected(m)}
            className="card-lux p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors"
          >
            {m.goal_hidden ? (
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" title="יעד חסוי">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (
              <ProgressRing progress={m.progress || 0} size={36} stroke={3} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Flame className="w-3 h-3 text-orange-400" /> {m.streak || 0}
                </span>
                <span className="text-[10px] gold-text font-bold">{m.xp || 0} XP</span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor[m.status] || "bg-gray-500"}`} />
                  <span className="text-[9px] text-muted-foreground">{m.status}</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNudgeTarget(m);
              }}
              className="p-2 rounded-lg bg-primary/15 text-primary shrink-0"
              title="דחיפה"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <ParticipantModal
          member={selected}
          onClose={() => setSelected(null)}
          sourceName={currentMember?.name}
          sourceUserId={currentUserId}
        />
      )}
      {nudgeTarget && (
        <NudgeModal
          member={nudgeTarget}
          sourceName={currentMember?.name}
          sourceUserId={currentUserId}
          onClose={() => setNudgeTarget(null)}
        />
      )}
    </div>
  );
}
