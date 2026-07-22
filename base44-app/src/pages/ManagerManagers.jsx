import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { Send, MessageSquare, X, ChevronLeft, FileText, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";

export default function ManagerManagers() {
  const { toast } = useToast();
  const [managers, setManagers] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMsgAll, setShowMsgAll] = useState(false);
  const [msgAll, setMsgAll] = useState("");
  const [selectedMgr, setSelectedMgr] = useState(null);
  const [mgrMsg, setMgrMsg] = useState("");
  const [showPersonalMsg, setShowPersonalMsg] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const user = await apiClient.auth.me();
        const myMembers = await apiClient.entities.Member.filter({ user_id: user.id });
        const me = myMembers[0];
        setCurrentMember(me);

        const allMembers = await apiClient.entities.Member.list();
        // Only show managers, exclude current user
        setManagers(allMembers.filter((m) => m.role === "manager" && m.user_id !== user.id));

        const allReports = await apiClient.entities.Report.list();
        setReports(allReports);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sendAll = async () => {
    if (!msgAll.trim() || !currentMember) return;
    await apiClient.entities.Notification.bulkCreate(
      managers
        .filter((m) => m.user_id)
        .map((mgr) => ({
          target_user_id: mgr.user_id,
          title: "הודעה ממנהל",
          body: msgAll.trim(),
          type: "info",
          source: currentMember.name,
          source_user_id: currentMember.user_id,
        }))
    );
    toast({ title: "ההודעה נשלחה", description: "ההודעה נשלחה לכל המנהלים" });
    setMsgAll("");
    setShowMsgAll(false);
  };

  const sendToManager = async () => {
    if (!mgrMsg.trim() || !selectedMgr || !currentMember) return;
    await apiClient.entities.Notification.create({
      target_user_id: selectedMgr.user_id,
      title: "הודעה ממנהל",
      body: mgrMsg.trim(),
      type: "info",
      source: currentMember.name,
      source_user_id: currentMember.user_id,
    });
    toast({ title: "ההודעה נשלחה", description: `ההודעה נשלחה ל${selectedMgr.name}` });
    setMgrMsg("");
    setShowPersonalMsg(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  // Manager detail view
  if (selectedMgr) {
    const mgrReports = reports.filter((r) => r.submitted_by === selectedMgr.group_name);
    return (
      <div className="p-4 space-y-4">
        <button onClick={() => setSelectedMgr(null)} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="w-4 h-4 rotate-180" /> חזרה
        </button>

        <div className="card-gold-rim p-5">
          <div className="flex items-center gap-3">
            <img
              src={selectedMgr.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMgr.name)}&background=1a1a1a&color=C5A880&bold=true`}
              alt={selectedMgr.name}
              className="w-14 h-14 rounded-full ring-2 ring-primary/40"
            />
            <div>
              <h2 className="font-bold text-lg">{selectedMgr.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedMgr.group_name}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card-lux p-3 text-center">
            <Users className="w-4 h-4 text-primary mx-auto" />
            <p className="font-bold text-sm mt-1">{selectedMgr.group_name ? "קבוצה" : "—"}</p>
            <p className="text-[9px] text-muted-foreground">קבוצה בניהול</p>
          </div>
          <div className="card-lux p-3 text-center">
            <FileText className="w-4 h-4 text-primary mx-auto" />
            <p className="font-bold text-sm mt-1">{mgrReports.length}</p>
            <p className="text-[9px] text-muted-foreground">דוחות</p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">הדוחות של {selectedMgr.name}</h3>
          {mgrReports.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">אין דוחות להצגה</p>
          ) : (
            mgrReports.map((r) => (
              <div key={r.id} className="card-lux p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{new Date(r.created_date).toLocaleDateString("he-IL")}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${r.status === "approved" ? "bg-green-500/15 text-green-500" : r.status === "pending" ? "bg-yellow-500/15 text-yellow-500" : "bg-red-500/15 text-red-500"}`}>
                    {r.status === "approved" ? "מאושר" : r.status === "pending" ? "ממתין" : "נדחה"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{r.content}</p>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => { setMgrMsg(""); setShowPersonalMsg(true); }}
          className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
        >
          <Send className="w-4 h-4" /> שלח הודעה ל{selectedMgr.name}
        </button>

        {showPersonalMsg && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowPersonalMsg(false)}>
            <div className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">שלח הודעה ל{selectedMgr.name}</h3>
                <button type="button" onClick={() => setShowPersonalMsg(false)} className="p-2 rounded-lg bg-muted"><X className="w-4 h-4" /></button>
              </div>
              <textarea
                value={mgrMsg}
                onChange={(e) => setMgrMsg(e.target.value)}
                placeholder="כתוב הודעה אישית…"
                className="w-full bg-input rounded-lg p-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowPersonalMsg(false)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">ביטול</button>
                <button onClick={sendToManager} disabled={!mgrMsg.trim()} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">שלח</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <PageHeader badge="אזור מנהל" title="מנהלים" subtitle={`${managers.length} מנהלים`} />

      <button
        onClick={() => setShowMsgAll(!showMsgAll)}
        className="w-full gold-gradient text-black font-bold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
      >
        <Send className="w-4 h-4" /> שלח הודעה לכל המנהלים
      </button>

      {showMsgAll && (
        <div className="card-lux p-3 space-y-2">
          <textarea
            value={msgAll}
            onChange={(e) => setMsgAll(e.target.value)}
            placeholder="כתוב הודעה לכל המנהלים..."
            className="w-full bg-input rounded-lg p-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowMsgAll(false)} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">ביטול</button>
            <button onClick={sendAll} disabled={!msgAll.trim()} className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40">שלח</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {managers.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">אין מנהלים נוספים להצגה</p>
          </div>
        )}
        {managers.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMgr(m)}
            className="w-full text-right card-lux p-3 flex items-center gap-3 hover:border-primary/30 transition-colors"
          >
            <img
              src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=1a1a1a&color=C5A880&bold=true`}
              alt={m.name}
              className="w-11 h-11 rounded-full ring-1 ring-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.group_name || "מנהל/ת קבוצה"}</p>
            </div>
            <div className="text-left shrink-0">
              <p className="text-xs gold-text font-bold">{m.xp || 0} XP</p>
              <p className="text-[9px] text-muted-foreground">{m.progress || 0}%</p>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}