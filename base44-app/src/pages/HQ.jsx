import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Users, Flame, Zap, Send, Shield, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ProgressRing from "@/components/ProgressRing";
import ParticipantModal from "@/components/ParticipantModal";
import UserAvatar from "@/components/UserAvatar";

const formatName = (name) => {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "משתמש";
  return `${parts[0]} ${parts[1][0]}.`;
};

export default function HQ() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [groupMsg, setGroupMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [nudgedUserIds, setNudgedUserIds] = useState(new Set());

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

          // Check recent nudges sent by this user to group members
          try {
            const allNudges = await apiClient.entities.Notification.filter({ type: "nudge" });
            const myName = me.name || user.full_name;
            const myNudges = allNudges.filter((n) => n.source === myName);
            setNudgedUserIds(new Set(myNudges.map((n) => n.target_user_id)));
          } catch (err) {
            console.error("[HQ] Failed to load nudge history:", err);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNudgeSent = (member) => {
    if (member?.user_id) {
      setNudgedUserIds((prev) => new Set([...prev, member.user_id]));
    }
    setSelectedMember(null);
  };

  const sendGroupMessage = async () => {
    if (!groupMsg.trim() || !currentMember) return;
    setSendingMsg(true);
    try {
      const targets = members.filter((m) => m.user_id && m.user_id !== currentMember.user_id);
      await apiClient.entities.Notification.bulkCreate(
        targets.map((m) => ({
          target_user_id: m.user_id,
          title: "הודעה מהקבוצה",
          body: groupMsg.trim(),
          type: "info",
          source: currentMember.name,
        }))
      );
      toast({ title: "ההודעה נשלחה! 📨", description: `לכל חברי הקבוצה (${targets.length})` });
      setGroupMsg("");
    } catch (err) {
      toast({ title: "שגיאה", description: "שליחת ההודעה נכשלה", variant: "destructive" });
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const groupName = group?.name || "הקבוצה שלי";
  const managerName = group?.manager_name || "—";

  return (
    <div className="p-4 space-y-5 pb-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="font-display text-2xl font-bold">חמ"ל הקבוצה</h1>
        <p className="text-sm text-muted-foreground">כוח הקומנדו</p>
      </div>

      {/* Group info card */}
      <div className="card-gold-rim p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold truncate">{groupName}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Users className="w-3.5 h-3.5" />
              <span>מנהל/ת: {managerName}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center italic">
          {members.length} לוחמים · אותו יעד · אין להשאיר פצועים בשטח
        </p>
      </div>

      {/* Member cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">חברי הקבוצה ({members.length})</h3>
        {members.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            עדיין לא שובצת לקבוצה.
          </p>
        )}
        {members.map((m) => {
          const isMe = currentMember?.user_id === m.user_id;
          const isNudged = nudgedUserIds.has(m.user_id);
          const isActive = m.status === "בעקבות";

          return (
            <div
              key={m.id}
              onClick={() => !isMe && setSelectedMember(m)}
              className={`card-lux p-3 ${isMe ? "border-primary/50" : "cursor-pointer hover:border-primary/30 transition-colors"}`}
            >
              <div className="flex items-center gap-3">
                {/* Identity */}
                <UserAvatar src={m.avatar_url} name={m.name} className="w-10 h-10 ring-1 ring-border shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {formatName(m.name)} {isMe && <span className="text-primary text-[10px]">(אתה)</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-yellow-400"}`} />
                    <span className="text-[10px] text-muted-foreground">{isActive ? "פעיל" : "לא עודכן"}</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-0.5 text-xs">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="font-bold">{m.streak || 0}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-xs">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold gold-text">{m.xp || 0}</span>
                  </div>
                </div>

                {/* Progress ring */}
                <ProgressRing progress={m.progress || 0} size={44} stroke={4} showText />
              </div>

              {/* Nudge indicator */}
              {isNudged && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-500 font-medium">
                  <Check className="w-3 h-3" />
                  נשלח דחיפה
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send message to group */}
      <div className="card-lux p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          שלח הודעה לקבוצה
        </h3>
        <textarea
          value={groupMsg}
          onChange={(e) => setGroupMsg(e.target.value)}
          placeholder="כתוב/י הודעה לכל חברי הקבוצה..."
          className="w-full bg-input rounded-lg p-3 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={sendGroupMessage}
          disabled={!groupMsg.trim() || sendingMsg}
          className="w-full gold-bg text-black rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sendingMsg ? "שולח..." : "שלח הודעה"}
        </button>
      </div>

      {/* Participant modal */}
      {selectedMember && (
        <ParticipantModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onNudgeSent={handleNudgeSent}
          sourceName={currentMember?.name}
          readOnly
        />
      )}
    </div>
  );
}