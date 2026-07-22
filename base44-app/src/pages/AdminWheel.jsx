import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Search, ChevronDown, ChevronLeft, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ProgressRing from "@/components/ProgressRing";
import { useToast } from "@/components/ui/use-toast";

export default function AdminWheel() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [m, g] = await Promise.all([apiClient.entities.Member.list(), apiClient.entities.Group.list()]);
        setMembers(m);
        setGroups(g);
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

  const nudge = (member) => {
    if (!member?.user_id) {
      toast({ title: "שגיאה", description: "לא נמצא משתמש לשליחה", variant: "destructive" });
      return;
    }
    apiClient.entities.Notification.create({
      target_user_id: member.user_id,
      title: "הודעה מהנהלת המערכת",
      body: "הגיע הזמן לעדכן את הגלגל 🎯",
      type: "nudge",
      source: "סופר-אדמין",
    });
    toast({ title: "דחיפה נשלחה", description: `אל ${member.name}` });
  };

  const filteredMembers = members.filter((m) => {
    if (query && !m.name?.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "low" && (m.progress || 0) >= 40) return false;
    if (filter === "mid" && ((m.progress || 0) < 40 || (m.progress || 0) > 70)) return false;
    if (filter === "high" && (m.progress || 0) <= 70) return false;
    if (filter === "inactive" && m.status !== "לא פעיל") return false;
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="סופר-אדמין" title="הגלגל" subtitle="ביקורת מערכתית" />

      {/* filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש..." className="w-full bg-input rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {[{ k: "all", l: "הכל" }, { k: "low", l: "מתחת ל-40%" }, { k: "mid", l: "40%-70%" }, { k: "high", l: "מעל 70%" }, { k: "inactive", l: "לא פעילים" }].map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* group tree */}
      <div className="space-y-2">
        {groups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">אין קבוצות עדיין</p>
        )}
        {groups.map((g) => {
          const gMembers = filteredMembers.filter((m) => m.group_name === g.name);
          const isOpen = expanded === g.id;
          return (
            <div key={g.id} className="card-lux">
              <button onClick={() => setExpanded(isOpen ? null : g.id)} className="w-full p-3 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${g.status === "on_track" ? "bg-green-500" : g.status === "needs_attention" ? "bg-orange-400" : "bg-red-500"}`} />
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{g.target} · {g.gender === "female" ? "נשים" : "גברים"} · {g.participant_count}/5</p>
                </div>
                <ProgressRing progress={g.avg_progress || 0} size={32} stroke={3} />
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {gMembers.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">אין חברים תואמים</p>}
                  {gMembers.map((m) => (
                    <div key={m.id} className="p-3 flex items-center gap-3">
                      <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`} alt="" className="w-8 h-8 rounded-full ring-1 ring-border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.status} · {m.progress || 0}%</p>
                      </div>
                      <ProgressRing progress={m.progress || 0} size={30} stroke={2.5} />
                      <button type="button" onClick={() => nudge(m)} className="p-2 rounded-lg bg-primary/15 text-primary"><Send className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* ungrouped members */}
        {filteredMembers.filter((m) => !groups.some((g) => g.name === m.group_name)).length > 0 && (
          <div className="card-lux">
            <button onClick={() => setExpanded(expanded === "ungrouped" ? null : "ungrouped")} className="w-full p-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <p className="text-sm font-medium flex-1 text-right">משתתפים כלליים</p>
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded === "ungrouped" ? "rotate-180" : ""}`} />
            </button>
            {expanded === "ungrouped" && (
              <div className="border-t border-border divide-y divide-border">
                {filteredMembers.filter((m) => !groups.some((g) => g.name === m.group_name)).map((m) => (
                  <div key={m.id} className="p-3 flex items-center gap-3">
                    <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`} alt="" className="w-8 h-8 rounded-full ring-1 ring-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.status} · {m.progress || 0}%</p>
                    </div>
                    <ProgressRing progress={m.progress || 0} size={30} stroke={2.5} />
                    <button type="button" onClick={() => nudge(m)} className="p-2 rounded-lg bg-primary/15 text-primary"><Send className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}