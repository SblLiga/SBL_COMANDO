import React, { useState, useEffect } from "react";
import apiClient from "@/api/apiClient";
import { FileText, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const typeLabel = {
  weekly: "סיכום שבועי",
  monthly: "סיכום חודשי",
  progress: "דוח התקדמות",
  anomaly: "דוח חריגות",
};

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

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
        {filtered.map((r) => (
          <div key={r.id} className="card-lux p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.submitted_by || "—"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {typeLabel[r.type] || r.type} ·{" "}
                  {new Date(r.created_date || r.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
            </div>
            {r.content && <p className="text-xs text-muted-foreground leading-snug line-clamp-3">{r.content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
