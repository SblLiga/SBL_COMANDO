import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Play, Clock, FileText, ChevronLeft, Send, Lock, X, Edit2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LiveMeeting, { AGENDA } from "@/components/LiveMeeting";
import { useToast } from "@/components/ui/use-toast";

export default function ManagerMeeting() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [liveMeetingId, setLiveMeetingId] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [groupName, setGroupName] = useState("הקבוצה שלי");
  const [editingSummary, setEditingSummary] = useState(null);
  const [editText, setEditText] = useState("");
  const [expandedPrev, setExpandedPrev] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        const myMembers = await base44.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        if (me?.group_id) {
          const groups = await base44.entities.Group.list();
          const g = groups.find((x) => x.id === me.group_id);
          if (g) setGroupName(g.name);
        }

        const m = await base44.entities.Meeting.list("-created_date", 20);
        setMeetings(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = async () => {
    const m = await base44.entities.Meeting.list("-created_date", 20);
    setMeetings(m);
  };

  const scheduleMeeting = async () => {
    if (!schedDate || !schedTime) return;
    const dt = new Date(`${schedDate}T${schedTime}`);
    const m = await base44.entities.Meeting.create({
      group_name: groupName,
      scheduled_date: dt.toISOString(),
      status: "scheduled",
      current_section: 0,
      duration_minutes: 90,
    });
    setMeetings([m, ...meetings]);
    setShowSchedule(false);
    setSchedDate("");
    setSchedTime("");
    toast({ title: "הפגישה נקבעה", description: `${schedDate} בשעה ${schedTime}` });
  };

  const startLive = async () => {
    const m = await base44.entities.Meeting.create({
      group_name: groupName,
      scheduled_date: new Date().toISOString(),
      status: "live",
      current_section: 0,
      duration_minutes: 90,
    });
    setLiveMeetingId(m.id);
    setLive(true);
  };

  const endLive = async (reports) => {
    if (liveMeetingId) {
      const summary = reports.map((r, i) => r ? `${i + 1}. ${AGENDA[i].title}: ${r}` : null).filter(Boolean).join("\n");
      await base44.entities.Meeting.update(liveMeetingId, {
        status: "completed",
        summary,
        section_reports: JSON.stringify(reports || []),
      });
      await refresh();
      toast({ title: "הפגישה הסתיימה ונשמרה ✓" });
    }
    setLive(false);
    setLiveMeetingId(null);
  };

  const sendToAdmin = async (meeting) => {
    await base44.entities.Report.create({
      type: "weekly",
      submitted_by: groupName,
      content: meeting.summary || "דוח פגישה שבועית - " + groupName,
      group_id: meeting.group_id,
      status: "pending",
    });
    await base44.entities.Meeting.update(meeting.id, { is_locked: true });
    await refresh();
    toast({ title: "הדוח נשלח לאדמין ✓", description: "הרשומה נעולה לעריכה" });
  };

  const saveSummaryEdit = async () => {
    if (!editingSummary) return;
    await base44.entities.Meeting.update(editingSummary.id, { summary: editText });
    await refresh();
    setEditingSummary(null);
    setEditText("");
    toast({ title: "הדוח עודכן ✓" });
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  if (live) return <LiveMeeting groupName={groupName} onEnd={endLive} />;

  const next = meetings.find((m) => m.status === "scheduled");
  const completedMeetings = meetings.filter((m) => m.status === "completed");
  const lastMeeting = completedMeetings[0]; // most recent
  const previousMeetings = completedMeetings.slice(1);

  return (
    <div className="p-4 space-y-5">
      <PageHeader badge="אזור מנהל" title="ישיבה שבועית" subtitle={groupName} />

      {/* Hero — next meeting */}
      <div className="card-gold-rim p-5 text-center">
        <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">הישיבה השבועית הבאה</p>
        <p className="font-bold text-lg">
          {next ? new Date(next.scheduled_date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) : "טרם נקבעה"}
        </p>
        {next && <p className="text-sm gold-text">{new Date(next.scheduled_date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>}
        <p className="text-xs text-muted-foreground mt-1">{groupName}</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowSchedule(!showSchedule)} className="card-lux p-4 flex flex-col items-center gap-2 border border-border hover:border-primary/30 transition-colors">
          <Calendar className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium">קבע פגישה</span>
        </button>
        <button onClick={startLive} className="card-gold-rim p-4 flex flex-col items-center gap-2 glow-gold">
          <Play className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium gold-text">התחל פגישה</span>
        </button>
      </div>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowSchedule(false)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> קביעת פגישה</h3>
              <button onClick={() => setShowSchedule(false)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">תאריך</label>
                <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">שעה</label>
                <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="w-full bg-input rounded-lg px-2 py-2 text-sm" />
              </div>
            </div>
            <button onClick={scheduleMeeting} disabled={!schedDate || !schedTime} className="w-full gold-bg text-black rounded-lg py-2.5 font-bold text-sm disabled:opacity-40">אישור וקביעת פגישה</button>
          </div>
        </div>
      )}

      {/* Agenda */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">נושאים למפגש</h3>
          <span className="text-xs text-muted-foreground">סה"כ 80 דקות</span>
        </div>
        <div className="card-lux divide-y divide-border">
          {AGENDA.map((a, i) => (
            <div key={i} className="p-3 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-sm flex-1">{a.title}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{a.minutes} דק'</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last meeting summary (9.3.2) */}
      {lastMeeting && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">סיכום הישיבה האחרונה</h3>
          <div className={`card-lux p-3 ${lastMeeting.is_locked ? "border-primary/30" : ""}`}>
            {editingSummary?.id === lastMeeting.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-input rounded-lg p-2.5 text-sm h-32 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={saveSummaryEdit} className="w-full gold-bg text-black rounded-lg py-2 text-sm font-bold">שמור דוח</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{new Date(lastMeeting.created_date).toLocaleDateString("he-IL")}</p>
                    {lastMeeting.is_locked && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Lock className="w-3 h-3" /> נשלח לאדמין</span>}
                  </div>
                  {!lastMeeting.is_locked && (
                    <button onClick={() => { setEditingSummary(lastMeeting); setEditText(lastMeeting.summary || ""); }} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-primary">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {lastMeeting.summary && (
                  <p className="text-xs text-muted-foreground leading-snug whitespace-pre-line">{lastMeeting.summary}</p>
                )}
                {!lastMeeting.is_locked && (
                  <button onClick={() => sendToAdmin(lastMeeting)} className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg gold-bg text-black font-bold">
                    <Send className="w-3.5 h-3.5" /> שלח לאדמין
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Previous meetings (9.4) */}
      {previousMeetings.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setExpandedPrev(!expandedPrev)} className="w-full text-right">
            <h3 className="text-sm font-bold flex items-center justify-between">
              סיכום הישיבות הקודמות
              <ChevronLeft className={`w-4 h-4 transition-transform ${expandedPrev ? "-rotate-90" : ""}`} />
            </h3>
          </button>
          {expandedPrev && (
            <div className="space-y-2">
              {previousMeetings.map((m) => (
                <div key={m.id} className="card-lux p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{new Date(m.created_date).toLocaleDateString("he-IL")}</p>
                    </div>
                    {m.is_locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  {m.summary && <p className="text-xs text-muted-foreground mt-2 leading-snug whitespace-pre-line line-clamp-3">{m.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}