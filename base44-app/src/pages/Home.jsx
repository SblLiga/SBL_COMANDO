import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Flame, Zap, Trophy, Gift, AlertCircle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import KpiCard from "@/components/KpiCard";

export default function Home() {
  const [goal, setGoal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [myMember, setMyMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const goals = await base44.entities.Goal.list();
        let g = goals[0] || null;
        setGoal(g);

        // Ensure a Member row is linked to the authenticated user (dynamic sync)
        let myMembers = await base44.entities.Member.filter({ user_id: user.id });
        let me = myMembers[0];
        if (!me) {
          me = await base44.entities.Member.create({
            name: user.full_name || user.email || "משתמש",
            user_id: user.id,
            goal_id: g?.id || null,
            goal_title: g?.title || null,
            goal_hidden: g?.is_hidden || false,
            target: g?.target || null,
            xp: g?.xp_total || 0,
            progress: g?.progress || 0,
            streak: g?.streak || 0,
            role: "user",
            status: "בעקבות",
          });
        } else if (g) {
          me = await base44.entities.Member.update(me.id, {
            xp: g.xp_total || 0,
            progress: g.progress || 0,
            streak: g.streak || 0,
            goal_id: g.id,
            goal_title: g.title,
            goal_hidden: g.is_hidden,
            target: g.target,
          });
        }
        setMyMember(me);

        if (g) {
          const t = await base44.entities.Task.filter({ goal_id: g.id });
          setTasks(t);
        }
        const m = await base44.entities.Member.list();
        setMembers(m);
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

  const completed = tasks.filter((t) => t.is_completed).length;
  const pct = goal?.progress || (tasks.length ? Math.round((completed / tasks.length) * 100) : 0);
  const xp = goal?.xp_total || myMember?.xp || 0;
  const streak = goal?.streak || myMember?.streak || 0;
  const remaining = tasks.filter((t) => !t.is_completed).length;
  const sorted = [...members].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const myRank = myMember ? sorted.findIndex((m) => m.id === myMember.id) + 1 : "—";
  const urgent = tasks.find((t) => !t.is_completed && t.priority === "דחוף");

  return (
    <div className="p-4 space-y-5">
      <div className="pt-3 pb-1">
        <h1 className="font-display text-2xl font-bold">ברוך שובך, {myMember?.gender === "female" ? "הכובשת" : "הכובש"}!</h1>
        <p className="text-sm text-muted-foreground">{myMember?.name || (myMember?.gender === "female" ? "מוכנה לקרב?" : "מוכן לקרב?")}</p>
      </div>

      <div className="card-gold-rim p-5 text-center">
        <p className="text-xs text-muted-foreground mb-1">התקדמות כללית אל היעד</p>
        <p className="font-display text-5xl font-bold gold-text text-shadow-gold">{pct}%</p>
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full gold-gradient rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{remaining > 0 ? `${remaining} משימות נותרו — לא עוזבים את השטח עד שזה מוכן` : "השטח נקי — כל המשימות הושלמו! 🎯"}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <KpiCard value={remaining} label="משימות שנותרו" />
        <KpiCard icon={Flame} value={streak} label="רצף" accent />
        <KpiCard icon={Zap} value={xp} label="XP" />
        <KpiCard icon={Trophy} value={`#${myRank}`} label="דירוג ליגה" />
      </div>

      {urgent && (
        <Link to="/goal" className="block">
          <div className="card-lux p-4 border-destructive/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-destructive font-bold">משימה דחופה</p>
              <p className="text-sm font-medium leading-tight">{urgent.title}</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </div>
        </Link>
      )}

      {goal?.reward_text && (
        <div className="card-gold-rim p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-black" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-primary font-bold">התגמול שלך ל-100%</p>
            <p className="text-sm font-medium">{goal.reward_text}</p>
          </div>
          <span className="font-display text-2xl font-bold gold-text">{pct}%</span>
        </div>
      )}

      <Link to="/goal" className="block w-full gold-gradient text-black font-bold rounded-xl py-3.5 text-center text-sm">
        לגלגל החכם שלי ←
      </Link>
    </div>
  );
}