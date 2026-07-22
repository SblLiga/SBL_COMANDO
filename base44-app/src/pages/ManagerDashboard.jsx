import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Flame, AlertTriangle, ChevronLeft, Zap, Users } from "lucide-react";
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

export default function ManagerDashboard() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setCurrentMember(me);

        if (me?.group_id) {
          const [groupMembers, groups] = await Promise.all([
            apiClient.entities.Member.filter({ group_id: me.group_id }),
            apiClient.entities.Group.list(),
          ]);
          setMembers(groupMembers);
          setGroup(groups.find((g) => g.id === me.group_id) || null);
        } else {
          const allMembers = await apiClient.entities.Member.list();
          setMembers(allMembers);
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

  const quickNudge = async (e, m) => {
    e.stopPropagation();
    await apiClient.entities.Notification.create({
      target_user_id: m.user_id,
      title: "דחיפה מהירה ⚡",
      body: "הגיע הזמן לעדכן את גלגל המשימות שלך 🎯",
      type: "nudge",
      source: currentMember?.name || "המנהל/ת שלך",
    });
    toast({ title: "דחיפה נשלחה ⚡", description: `אל ${m.name}` });
  };

  return (
    <div className="p-4 space-y-5">
      <PageHeader badge="אזור מנהל" title="בית" subtitle="סקירת הכוח שלך בשטח" />

      {/* Hero card */}
      <div className="card-gold-rim p-5 text-center">
        <h2 className="font-display text-lg font-bold mb-1">{groupName}</h2>
        <p className="font-display text-5xl font-bold gold-text text-shadow-gold">{avg}%</p>
        <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
          <Users className="w-3.5 h-3.5" /> {members.length} חברים בקבוצה
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard value={`${avg}%`} label="צביעה ממוצעת" accent />
        <KpiCard icon={AlertTriangle} value={redLights.length} label="נורות אדומות" className="border-destructive/30" />
      </div>

      {/* Red lights */}
      {redLights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-destructive">נורות אדומות</h3>
          <p className="text-[10px] text-muted-foreground mb-1">לא משאירים חיילים בשטח ⚔️</p>
          {redLights.map((m) => {
          const daysInactive = Math.floor((Date.now() - new Date(m.updated_date)) / 86400000);
          return (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className="w-full text-right card-lux p-3 flex items-center gap-3 border-destructive/30"
          >
            <img
              src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`}
              alt=""
              className="w-9 h-9 rounded-full ring-1 ring-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.status} · {daysInactive} ימים ללא פעילות</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          );
          })}
        </div>
      )}

      {/* Team board */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">לוח הצוות ({members.length})</h3>
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