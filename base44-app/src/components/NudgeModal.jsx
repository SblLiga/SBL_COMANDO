import React, { useState } from "react";
import apiClient from "@/api/apiClient";
import { X, Zap, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const NUDGE_TEMPLATES = [
  "זמן לעדכן את גלגל המשימות שלך",
  "מתכוננים לישיבה השבועית הקרובה",
  "שמתי לב שלא עודכנה התקדמות השבוע",
  "כל הכבוד על ההתקדמות! ממשיכים קדימה",
];

/**
 * Spec §7 — Nudge modal: templates | free text, Cancel + Send.
 */
export default function NudgeModal({ member, sourceName, sourceUserId, onClose, onSent }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("templates");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [sending, setSending] = useState(false);

  if (!member) return null;

  const body = tab === "templates" ? selectedTemplate : customMsg.trim();
  const canSend = Boolean(body) && Boolean(member.user_id);

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      await apiClient.entities.Notification.create({
        target_user_id: member.user_id,
        title: sourceName ? "הודעה מהקבוצה" : "הודעה מהמנהל/ת",
        body,
        type: "nudge",
        source: sourceName || "המנהל/ת שלך",
        source_user_id: sourceUserId || undefined,
      });
      toast({
        title: "הדחיפה נשלחה",
        description: `הודעה נשלחה ל${member.name}`,
      });
      onSent?.(member);
      onClose();
    } catch (err) {
      console.error("[NudgeModal]", err);
      toast({ title: "שגיאה", description: "שליחת הדחיפה נכשלה", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="card-lux w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            שליחת דחיפה · {member.name}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg bg-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("templates")}
            className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "templates" ? "gold-bg text-black font-bold" : "bg-muted"}`}
          >
            תבניות מוכנות
          </button>
          <button
            type="button"
            onClick={() => setTab("custom")}
            className={`flex-1 text-xs py-1.5 rounded-lg ${tab === "custom" ? "gold-bg text-black font-bold" : "bg-muted"}`}
          >
            הודעה חופשית
          </button>
        </div>

        {tab === "templates" ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {NUDGE_TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTemplate(t)}
                className={`w-full text-right text-xs p-2.5 rounded-lg transition-colors ${
                  selectedTemplate === t ? "gold-bg text-black font-medium" : "bg-muted hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            placeholder="כתבי הודעה מותאמת אישית..."
            className="w-full bg-input rounded-lg p-2.5 text-xs h-28 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 bg-muted rounded-lg py-2.5 text-sm font-medium">
            ביטול
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend || sending}
            className="flex-1 gold-bg text-black rounded-lg py-2.5 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? "שולח..." : "שליחת דחיפה"}
          </button>
        </div>
      </div>
    </div>
  );
}
