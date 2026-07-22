import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { FileText, CheckCircle2, Clock, XCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const statusMeta = {
  approved: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/15", label: "אושר" },
  pending: { icon: Clock, color: "text-orange-400", bg: "bg-orange-400/15", label: "ממתין" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/15", label: "נדחה" },
};

const typeLabel = { weekly: "שבועי", monthly: "חודשי", progress: "התקדמות", anomaly: "חריגה" };

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      <PageHeader badge="סופר-אדמין" title="דוחות" subtitle={`${reports.length} דוחות`} />

      <div className="flex gap-2 overflow-x-auto">
        {[{ k: "all", l: "הכל" }, { k: "approved", l: "אושר" }, { k: "pending", l: "ממתין" }, { k: "rejected", l: "נדחה" }].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${filter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}>{f.l}</button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[{ k: "all", l: "כל הסוגים" }, { k: "weekly", l: "שבועי" }, { k: "monthly", l: "חודשי" }, { k: "progress", l: "התקדמות" }, { k: "anomaly", l: "חריגות" }].map((f) => (
          <button key={f.k} onClick={() => setTypeFilter(f.k)} className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap ${typeFilter === f.k ? "gold-bg text-black font-bold" : "bg-muted"}`}>{f.l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">אין דוחות</p>
          </div>
        )}
        {filtered.map((r) => {
          const st = statusMeta[r.status] || statusMeta.pending;
          const Icon = st.icon;
          return (
            <div key={r.id} className="card-lux p-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${st.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${st.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">דוח {typeLabel[r.type] || r.type}</p>
                  <p className="text-[10px] text-muted-foreground">{r.submitted_by} · {new Date(r.created_date).toLocaleDateString("he-IL")}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg} ${st.color} font-bold`}>{st.label}</span>
              </div>
              {r.content && <p className="text-xs text-muted-foreground mt-2 leading-snug line-clamp-2">{r.content}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}