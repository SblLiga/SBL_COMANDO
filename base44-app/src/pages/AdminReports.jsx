import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { FileText, CheckCircle2, Clock, XCircle, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";

const statusMeta = {
  approved: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/15", label: "אושר" },
  pending: { icon: Clock, color: "text-orange-400", bg: "bg-orange-400/15", label: "ממתין" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/15", label: "נדחה" },
};

const typeLabel = { weekly: "סיכום שבועי", monthly: "סיכום חודשי", progress: "דוח התקדמות", anomaly: "דוח חריגות" };

export default function AdminReports() {
  const { toast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiClient.entities.Report.list("-created_date", 50);
        setReports(r);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setStatus = async (report, status) => {
    setBusyId(report.id);
    try {
      const updated = await apiClient.entities.Report.update(report.id, { status });
      setReports((prev) => prev.map((x) => (x.id === report.id ? updated : x)));
      toast({ title: status === "approved" ? "הדוח אושר" : "הדוח נדחה" });
    } catch (err) {
      toast({ title: "שגיאה", description: err.message || "עדכון הדוח נכשל", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${r.submitted_by || ""} ${r.content || ""} ${r.type || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="אזור אדמין" title="דוחות" subtitle={`${reports.length} דוחות`} />

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם או קבוצה..."
          className="w-full bg-input rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[
          { k: "all", l: "הכל" },
          { k: "approved", l: "אושר" },
          { k: "pending", l: "ממתין" },
          { k: "rejected", l: "נדחה" },
        ].map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setFilter(f.k)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[
          { k: "all", l: "כל הסוגים" },
          { k: "weekly", l: "שבועי" },
          { k: "monthly", l: "חודשי" },
          { k: "progress", l: "התקדמות" },
          { k: "anomaly", l: "חריגות" },
        ].map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setTypeFilter(f.k)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${typeFilter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">לא נמצאו דוחות תואמים</p>
          </div>
        )}
        {filtered.map((r) => {
          const st = statusMeta[r.status] || statusMeta.pending;
          const Icon = st.icon;
          return (
            <div key={r.id} className="card-lux p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${st.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${st.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.submitted_by || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {typeLabel[r.type] || r.type} · {new Date(r.created_date).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg} ${st.color} font-bold`}>{st.label}</span>
              </div>
              {r.content && <p className="text-xs text-muted-foreground leading-snug line-clamp-3">{r.content}</p>}
              {(r.status === "pending" || !r.status) && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r, "approved")}
                    className="flex-1 text-xs py-2 rounded-lg bg-green-500/15 text-green-500 font-bold disabled:opacity-40"
                  >
                    אישור
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setStatus(r, "rejected")}
                    className="flex-1 text-xs py-2 rounded-lg bg-red-500/15 text-red-500 font-bold disabled:opacity-40"
                  >
                    דחייה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
