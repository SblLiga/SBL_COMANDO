import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Calendar, Play, Clock, FileText, ChevronLeft, Send, Lock, X, Edit2, Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LiveMeeting, { AGENDA } from "@/components/LiveMeeting";
import { useToast } from "@/components/ui/use-toast";
import { resolveManagerOwnedGroup } from "@/lib/managerGroup";

function meetingWhen(m) {
  return new Date(m.scheduled_date || m.created_date || m.created_at || 0);
}

function meetingDateLabel(m) {
  return meetingWhen(m).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildSummary(reports) {
  return (reports || [])
    .map((r, i) => (r ? `${i + 1}. ${AGENDA[i].title}: ${r}` : null))
    .filter(Boolean)
    .join("\n");
}

function parseSectionReports(meeting) {
  try {
    const arr = JSON.parse(meeting?.section_reports || "[]");
    if (Array.isArray(arr) && arr.length) {
      return AGENDA.map((_, i) => arr[i] || "");
    }
  } catch {
    /* ignore */
  }
  return AGENDA.map(() => "");
}

function reportStatusOf(m) {
  if (m.report_status) return m.report_status;
  if (m.status !== "completed") return null;
  return m.is_locked ? "pending" : "draft";
}

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
  const [groupId, setGroupId] = useState(null);
  const [editingSummary, setEditingSummary] = useState(null);
  const [editSections, setEditSections] = useState(AGENDA.map(() => ""));
  const [expandedPrev, setExpandedPrev] = useState(false);
  const [viewingPrev, setViewingPrev] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        const { group } = await resolveManagerOwnedGroup(user);
        if (group) {
          setGroupName(group.name || "הקבוצה שלי");
          setGroupId(group.id);
        }

        const m = group?.id
          ? await apiClient.entities.Meeting.filter({ group_id: group.id })
          : await apiClient.entities.Meeting.list("-created_date", 20);
        setMeetings(Array.isArray(m) ? m : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = async () => {
    const m = groupId
      ? await apiClient.entities.Meeting.filter({ group_id: groupId })
      : await apiClient.entities.Meeting.list("-created_date", 20);
    setMeetings(Array.isArray(m) ? m : []);
  };

  const scheduleMeeting = async () => {
    if (!schedDate || !schedTime) return;
    const dt = new Date(`${schedDate}T${schedTime}`);
    const m = await apiClient.entities.Meeting.create({
      group_name: groupName,
      group_id: groupId || undefined,
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
    const startable = meetings.find((m) => {
      if (m.status !== "scheduled") return false;
      const meetingDate = new Date(m.scheduled_date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return meetingDate <= today;
    }) || meetings.find((m) => m.status === "live");
    if (!startable) {
      toast({
        title: "אין פגישה מתוכננת להיום",
        description: "קבע/י פגישה לתאריך היום תחילה",
        variant: "destructive",
      });
      return;
    }
    const updated = await apiClient.entities.Meeting.update(startable.id, {
      status: "live",
      current_section: 0,
    });
    setLiveMeetingId(updated.id);
    setLive(true);
  };

  const saveLiveDraft = async (reports) => {
    if (!liveMeetingId) return;
    try {
      await apiClient.entities.Meeting.update(liveMeetingId, {
        summary: buildSummary(reports),
        section_reports: JSON.stringify(reports || []),
      });
    } catch (err) {
      console.error("[ManagerMeeting] draft save failed", err);
    }
  };

  const endLive = async (reports) => {
    if (!liveMeetingId) {
      setLive(false);
      return;
    }
    await apiClient.entities.Meeting.update(liveMeetingId, {
      status: "completed",
      summary: buildSummary(reports),
      section_reports: JSON.stringify(reports || []),
      report_status: "draft",
      is_locked: false,
    });
    await refresh();
    toast({ title: "הפגישה הסתיימה ונשמרה ✓", description: "הדוח בסיכום הישיבה האחרונה" });
    setLive(false);
    setLiveMeetingId(null);
  };

  const sendToAdmin = async (meeting) => {
    const content = (meeting.summary || "").trim();
    if (!content) {
      toast({ title: "מלא/י דוח לפני שליחה", variant: "destructive" });
      return;
    }
    await apiClient.entities.Report.create({
      type: "weekly",
      submitted_by: groupName,
      content,
      group_id: meeting.group_id || groupId || undefined,
      meeting_id: meeting.id,
      status: "pending",
    });
    await apiClient.entities.Meeting.update(meeting.id, {
      is_locked: true,
      report_status: "pending",
    });
    await refresh();
    toast({ title: "הדוח נשלח לאדמין ✓", description: "הרשומה נעולה לעריכה" });
  };

  const saveSummaryEdit = async () => {
    if (!editingSummary) return;
    const summary = buildSummary(editSections);
    await apiClient.entities.Meeting.update(editingSummary.id, {
      summary,
      section_reports: JSON.stringify(editSections),
      report_status: "draft",
      is_locked: false,
    });
    await refresh();
    setEditingSummary(null);
    setEditSections(AGENDA.map(() => ""));
    toast({ title: "הדוח עודכן ✓" });
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  if (live) {
    return (
      <LiveMeeting
        groupName={groupName}
        onEnd={endLive}
        onDraftSave={saveLiveDraft}
      />
    );
  }

  const next = meetings.find((m) => m.status === "scheduled");
  const completedSorted = meetings
    .filter((m) => m.status === "completed")
    .slice()
    .sort((a, b) => meetingWhen(b) - meetingWhen(a));

  // Newest non-approved report stays in "last summary"; older pending wait independently.
  const lastMeeting = completedSorted.find((m) => {
    const s = reportStatusOf(m);
    return s === "draft" || s === "pending";
  });
  const previousMeetings = completedSorted.filter((m) => reportStatusOf(m) === "approved");

  const canStartLive = meetings.some((m) => {
    if (m.status === "live") return true;
    if (m.status !== "scheduled") return false;
    const meetingDate = new Date(m.scheduled_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return meetingDate <= today;
  });

  const lastLocked = lastMeeting && reportStatusOf(lastMeeting) !== "draft";

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
        <button
          onClick={startLive}
          disabled={!canStartLive}
          className={`p-4 flex flex-col items-center gap-2 border transition-colors ${
            canStartLive
              ? "card-gold-rim glow-gold"
              : "card-lux border-border opacity-50 cursor-not-allowed"
          }`}
        >
          <Play className="w-6 h-6 text-primary" />
          <span className={`text-sm font-medium ${canStartLive ? "gold-text" : "text-muted-foreground"}`}>
            התחל פגישה
          </span>
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

      {/* Last meeting summary */}
      {lastMeeting && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">סיכום הישיבה האחרונה</h3>
          <div className={`card-lux p-3 ${lastLocked ? "border border-primary/30" : ""}`}>
            {editingSummary?.id === lastMeeting.id ? (
              <div className="space-y-3">
                {AGENDA.map((a, i) => (
                  <div key={a.title} className="space-y-1">
                    <label className="text-xs font-bold">{i + 1}. {a.title}</label>
                    <textarea
                      value={editSections[i]}
                      onChange={(e) => {
                        const next = [...editSections];
                        next[i] = e.target.value;
                        setEditSections(next);
                      }}
                      className="w-full bg-input rounded-lg p-2.5 text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
                <button onClick={saveSummaryEdit} className="w-full gold-bg text-black rounded-lg py-2 text-sm font-bold">שמור דוח</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{meetingDateLabel(lastMeeting)}</p>
                    {lastLocked && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Lock className="w-3 h-3" /> ממתין לאישור אדמין
                      </span>
                    )}
                  </div>
                  {!lastLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSummary(lastMeeting);
                        setEditSections(parseSectionReports(lastMeeting));
                      }}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-primary"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {lastMeeting.summary && (
                  <p className="text-xs text-muted-foreground leading-snug whitespace-pre-line">{lastMeeting.summary}</p>
                )}
                {!lastLocked && (
                  <button
                    type="button"
                    onClick={() => sendToAdmin(lastMeeting)}
                    disabled={!lastMeeting.summary?.trim()}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg gold-bg text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" /> {lastMeeting.summary?.trim() ? "שלח לאדמין" : "מלא/י דוח לפני שליחה"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Previous approved meetings */}
      <div className="space-y-2">
        <button type="button" onClick={() => setExpandedPrev(!expandedPrev)} className="w-full text-right">
          <h3 className="text-sm font-bold flex items-center justify-between">
            סיכום הישיבות הקודמות
            <ChevronLeft className={`w-4 h-4 transition-transform ${expandedPrev ? "-rotate-90" : ""}`} />
          </h3>
        </button>
        {expandedPrev && (
          <div className="space-y-2">
            {previousMeetings.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">אין דוחות מאושרים עדיין</p>
            )}
            {previousMeetings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewingPrev(m)}
                className="w-full card-lux p-3 text-right hover:border-primary/30 border border-transparent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{meetingDateLabel(m)}</p>
                    <p className="text-[10px] text-muted-foreground">אושר · לצפייה בלבד</p>
                  </div>
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewingPrev && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewingPrev(null)}>
          <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">{meetingDateLabel(viewingPrev)}</h3>
              <button type="button" onClick={() => setViewingPrev(null)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> צפייה בלבד · ללא עריכה</p>
            {AGENDA.map((a, i) => {
              const sections = parseSectionReports(viewingPrev);
              const text = sections[i] || "";
              if (!text && !viewingPrev.summary) return null;
              return (
                <div key={a.title} className="space-y-1">
                  <p className="text-xs font-bold">{i + 1}. {a.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-snug">
                    {text || "—"}
                  </p>
                </div>
              );
            })}
            {!viewingPrev.section_reports && viewingPrev.summary && (
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-snug">{viewingPrev.summary}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
