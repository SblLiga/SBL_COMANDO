import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Flame, Zap, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import ProgressRing from "@/components/ProgressRing";
import ParticipantModal from "@/components/ParticipantModal";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const myMembers = await base44.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setCurrentMember(me);

        if (me?.group_id) {
          const [groupMembers, groups] = await Promise.all([
            base44.entities.Member.filter({ group_id: me.group_id }),
            base44.entities.Group.list(),
          ]);
          setMembers(groupMembers);
          setGroup(groups.find((g) => g.id === me.group_id) || null);
        }
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

  const quickNudge = async (e, m) => {
    e.stopPropagation();
    await base44.entities.Notification.create({
      target_user_id: m.user_id,
      title: "דחיפה מהירה ⚡",
      body: "הגיע הזמן לעדכן את גלגל המשימות שלך 🎯",
      type: "nudge",
      source: currentMember?.name || "המנהל/ת שלך",
    });
    toast({ title: "דחיפה נשלחה ⚡", description: `אל ${m.name}` });
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור מנהל" title="הקבוצה שלי" subtitle={`${members.length} לוחמים בשטח`} />

      {/* Group summary card */}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard value={`${avg}%`} label="צביעה ממוצעת" accent />
        <KpiCard icon={Flame} value={redLights.length} label="נורות אדומות" className="border-destructive/30" />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">חברי הקבוצה ({members.length})</h3>
        {members.map((m) => (
          <div
            key={m.id}
            onClick={() => setSelected(m)}
            className="card-lux p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors"
          >
            <ProgressRing progress={m.progress || 0} size={36} stroke={3} />
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
              onClick={(e) => quickNudge(e, m)}
              className="p-2 rounded-lg bg-primary/15 text-primary shrink-0"
              title="דחיפה"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {selected && <ParticipantModal member={selected} onClose={() => setSelected(null)} sourceName={currentMember?.name} />}
    </div>
  );
}