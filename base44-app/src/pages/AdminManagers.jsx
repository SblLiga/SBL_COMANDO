import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Calendar, Clock, ChevronLeft, Star } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function AdminManagers() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSched, setShowSched] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(1.5);

  useEffect(() => {
    (async () => {
      try {
        const m = await apiClient.entities.Member.list();
        setMembers(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleRole = async (m) => {
    const newRole = m.role === "manager" ? "user" : "manager";
    const updated = await apiClient.entities.Member.update(m.id, { role: newRole });
    // Sync the linked User entity so routing/auth reflects the change instantly
    if (m.user_id) {
      try {
        await apiClient.entities.User.update(m.user_id, { role: newRole });
      } catch (err) {
        console.error("[AdminManagers] User role sync failed:", err);
      }
    }
    setMembers(members.map((x) => (x.id === m.id ? updated : x)));
    toast({ title: newRole === "manager" ? "קודם/ה למנהל/ת! ⭐" : "הורד/ה למשתמש/ת", description: m.name });
  };

  const schedule = () => {
    if (!date || !startTime) return;
    const dayName = new Date(`${date}T${startTime}`).toLocaleDateString("he-IL", { weekday: "long" });
    toast({ title: "נקבעה פגישה עם שולי", description: `${dayName} בשעה ${startTime} · ${duration} שעות` });
    apiClient.entities.Notification.bulkCreate(
      members.map((m) => ({ title: "נקבעה פגישה עם שולי", body: `יום ${dayName} בשעה ${startTime}`, type: "info", source: "סופר-אדמין" }))
    );
    setShowSched(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-4 space-y-5">
      <PageHeader badge="אזור מנהל - מנהלים" title="מנהלות" subtitle={`${members.length} משתמשים`} />

      <button onClick={() => setShowSched(!showSched)} className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm">
        <Calendar className="w-4 h-4" /> קבע פגישה
      </button>

      {showSched && (
        <div className="card-gold-rim p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">תאריך</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">שעת התחלה</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">משך</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {[1, 1.5, 2, 3].map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={`py-2 rounded-lg text-sm ${duration === d ? "gold-bg text-black font-bold" : "bg-muted"}`}>{d}ש׳</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">סיום מחושב</span>
            <span className="font-bold gold-text">
              {startTime ? new Date(new Date(`2000-01-01T${startTime}`).getTime() + duration * 3600000).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </span>
          </div>
          <button onClick={schedule} className="w-full gold-bg text-black rounded-lg py-2.5 font-bold text-sm">אשר ושדר</button>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="card-lux p-3 flex items-center gap-3">
            <div className="relative">
              <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`} alt="" className="w-10 h-10 rounded-full ring-1 ring-border" />
              {m.role === "manager" && <Star className="absolute -top-1 -left-1 w-4 h-4 text-primary fill-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.group_name || "—"}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold ${m.role === "manager" ? "gold-text" : "text-muted-foreground"}`}>{m.role === "manager" ? "מנהל/ת" : "משתמש/ת"}</span>
              <Switch checked={m.role === "manager"} onCheckedChange={() => toggleRole(m)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}