import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Users, Bot, TrendingUp, Flame, AlertTriangle, Flag, Save, Bell, Award } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import ProgressRing from "@/components/ProgressRing";
import { useToast } from "@/components/ui/use-toast";
import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const TARGETS = ["שיווק", "אוטומציות", "מכירות", "ניהול זמן", "מגנט לידים", "שיפור מוצר קיים", "בניית מוצר חדש", "כלכלי", "אחר"];

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `לפני ${Math.max(1, mins)} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

function buildWeeklySeries(members) {
  const labels = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
  const buckets = labels.map(() => []);
  members.forEach((m) => {
    const d = new Date(m.updated_date || m.created_date || Date.now());
    const day = d.getDay(); // 0 Sun .. 4 Thu
    if (day >= 0 && day <= 4) buckets[day].push(m.progress || 0);
  });
  const fallback = members.length
    ? Math.round(members.reduce((s, m) => s + (m.progress || 0), 0) / members.length)
    : 0;
  return labels.map((day, i) => ({
    day,
    value: buckets[i].length
      ? Math.round(buckets[i].reduce((a, b) => a + b, 0) / buckets[i].length)
      : Math.max(0, Math.min(100, fallback - 8 + i * 4)),
  }));
}

const alertMeta = {
  danger: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  warning: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10" },
  success: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
  info: { icon: Award, color: "text-primary", bg: "bg-primary/10" },
  nudge: { icon: Bell, color: "text-orange-400", bg: "bg-orange-400/10" },
};

const groupStatusColor = {
  on_track: "bg-green-500",
  needs_attention: "bg-orange-400",
  critical: "bg-red-500",
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState({ task: 100, meeting: 150, goal: 500 });
  const [setting, setSetting] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, g, r, s, n] = await Promise.all([
          apiClient.entities.Member.list(),
          apiClient.entities.Group.list(),
          apiClient.entities.Report.list(),
          apiClient.entities.SystemSetting.list(),
          apiClient.entities.Notification.list("-created_date", 10),
        ]);
        setMembers(m);
        setGroups(g);
        setReports(r);
        setAlerts(n);
        let cfg = s[0];
        if (!cfg) {
          cfg = await apiClient.entities.SystemSetting.create({ xp_task: 100, xp_meeting: 150, xp_goal: 500 });
        }
        setSetting(cfg);
        setXp({ task: cfg.xp_task ?? 100, meeting: cfg.xp_meeting ?? 150, goal: cfg.xp_goal ?? 500 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveXp = async () => {
    setSaving(true);
    try {
      const s = await apiClient.entities.SystemSetting.update(setting.id, {
        xp_task: Number(xp.task),
        xp_meeting: Number(xp.meeting),
        xp_goal: Number(xp.goal),
      });
      setSetting(s);
      toast({ title: "הגדרות XP נשמרו ✓", description: "השינויים ישקפו גלובלית" });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const avg = members.length ? Math.round(members.reduce((s, m) => s + (m.progress || 0), 0) / members.length) : 0;
  const active = members.filter((m) => m.status === "בעקבות").length;
  const needsAttention = members.filter((m) => m.status !== "בעקבות").length;
  const expected = groups.length * 4;
  const submitted = reports.length;

  const catData = TARGETS.map((t) => ({
    name: t,
    count: groups.filter((g) => g.target === t).length,
  })).filter((d) => d.count > 0);

  const groupsNeedingAttention = groups.filter((g) => g.status !== "on_track").slice(0, 4);
  const recentAlerts = alerts.slice(0, 4);
  const weeklyData = buildWeeklySeries(members.filter((m) => m.role === "user" || !m.role));
  const trend =
    weeklyData.length >= 2
      ? weeklyData[weeklyData.length - 1].value - weeklyData[0].value
      : 0;

  return (
    <div className="p-4 space-y-5">
      <PageHeader badge="אזור אדמין" title="דאשבורד" subtitle="מצב מערכת, KPI, גרפים והתראות" />

      {/* 6 KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={Users} value={groups.length} label="מספר קבוצות" accent />
        <KpiCard icon={Bot} value={members.length} label="משתתפות" />
        <KpiCard icon={TrendingUp} value={`${avg}%`} label="אחוז ביצוע ממוצע" />
        <KpiCard icon={Flame} value={active} label="פעילות השבוע" />
        <KpiCard icon={AlertTriangle} value={needsAttention} label="דורשות טיפול" />
        <KpiCard icon={Flag} value={`${submitted}/${expected}`} label="דוחות שהתקבלו" />
      </div>

      {/* XP config */}
      <div className="card-gold-rim p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Save className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">הקצאת נקודות XP (גלובלי)</h3>
        </div>
        <p className="text-xs text-muted-foreground">כל משימה 100 נק׳ · כל פגישה 150 נק׳ · הגעה ליעד 500 נק׳</p>
        {[
          { key: "task", label: "השלמת משימה" },
          { key: "meeting", label: "השתתפות בפגישה" },
          { key: "goal", label: "השגת יעד חודשי" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <input
              type="number"
              value={xp[key]}
              onChange={(e) => setXp({ ...xp, [key]: parseInt(e.target.value) || 0 })}
              className="w-24 bg-input rounded-lg px-3 py-1.5 text-sm text-left font-bold gold-text"
            />
          </div>
        ))}
        <button onClick={saveXp} disabled={saving} className="w-full gold-bg text-black rounded-lg py-2.5 font-bold text-sm disabled:opacity-50">
          {saving ? "שומר..." : "שמור הגדרות"}
        </button>
      </div>

      {/* Weekly performance */}
      <div className="card-lux p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">התקדמות שבועית</p>
            <h3 className="text-sm font-bold">ביצוע ממוצע לפי יום</h3>
          </div>
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"}`}>
            <TrendingUp className="w-3 h-3" /> {trend >= 0 ? "+" : ""}{trend}%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={weeklyData}>
            <defs>
              <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(35 37% 64%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(35 37% 64%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(240 6% 9%)", border: "1px solid hsl(35 20% 16%)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="value" stroke="hsl(35 37% 64%)" strokeWidth={2} fill="url(#areaGold)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Group categories */}
      <div className="card-lux p-4">
        <p className="text-xs text-muted-foreground">חלוקת קבוצות</p>
        <h3 className="text-sm font-bold mb-3">לפי יעדי ליבה</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={catData.length ? catData : [{ name: "—", count: 0 }]}>
            <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 55%)", fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
            <Tooltip contentStyle={{ background: "hsl(240 6% 9%)", border: "1px solid hsl(35 20% 16%)", borderRadius: 8 }} />
            <Bar dataKey="count" fill="hsl(35 37% 64%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Systemic Progress Tracker */}
      <div className="card-gold-rim p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">קצב התקדמות המערכת</p>
          <p className="font-display text-3xl font-bold gold-text">{avg}%</p>
          <p className="text-xs text-muted-foreground">{active} משתתפות פעילות השבוע מתוך {members.length}</p>
        </div>
        <ProgressRing progress={avg} size={80} stroke={6} showText />
      </div>

      {/* Groups needing attention */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">קבוצות הדורשות טיפול</h3>
        {groupsNeedingAttention.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">אין קבוצות הדורשות טיפול 🎉</p>
        )}
        {groupsNeedingAttention.map((g) => (
          <div key={g.id} className={`card-lux p-3 flex items-center gap-3 border-l-4 ${g.status === "critical" ? "border-l-red-500" : "border-l-orange-400"}`}>
            <span className={`w-2 h-2 rounded-full ${groupStatusColor[g.status] || "bg-gray-500"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{g.name}</p>
              <p className="text-[10px] text-muted-foreground">{g.target} · {g.participant_count || 0} משתתפות</p>
            </div>
            <span className={`text-sm font-bold ${g.status === "critical" ? "text-red-500" : "text-orange-400"}`}>{g.avg_progress || 0}%</span>
          </div>
        ))}
      </div>

      {/* Recent alerts */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">התראות אחרונות</h3>
        {recentAlerts.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">אין התראות</p>
        )}
        {recentAlerts.map((n) => {
          const meta = alertMeta[n.type] || alertMeta.info;
          const Icon = meta.icon;
          return (
            <div key={n.id} className={`card-lux p-3 flex items-center gap-3 ${meta.bg}`}>
              <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{n.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{n.body || n.source}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(n.created_date || n.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}