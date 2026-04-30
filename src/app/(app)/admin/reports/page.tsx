"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface AttendanceRow {
  employee: string;
  employee_id: number;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  scheduled_hours: number;
  actual_hours: number | null;
  clock_in: string | null;
  clock_out: string | null;
  flags: string[];
}

const flagLabels: Record<string, { label: string; variant: "warning" | "danger" }> = {
  missing_clock_in: { label: "No clock-in", variant: "danger" },
  missing_clock_out: { label: "No clock-out", variant: "warning" },
  late_clock_in: { label: "Late", variant: "warning" },
  overtime: { label: "Overtime", variant: "danger" },
};

export default function AdminReportsPage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/reports/attendance")
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
  }, []);

  const flagged = rows.filter((r) => r.flags.length > 0);
  const clean = rows.filter((r) => r.flags.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Attendance Reports
        </h1>
        <p className="mt-1 text-neutral-500">
          Review discrepancies and attendance data
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase">Total</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase">
            Flagged
          </p>
          <p className="mt-1 text-2xl font-bold text-danger-500">
            {flagged.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase">Clean</p>
          <p className="mt-1 text-2xl font-bold text-success-500">
            {clean.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase">
            Avg Hours
          </p>
          <p className="mt-1 text-2xl font-bold">
            {rows.length > 0
              ? (
                  rows.reduce((s, r) => s + (r.actual_hours || 0), 0) /
                  rows.filter((r) => r.actual_hours).length
                ).toFixed(1)
              : "–"}
            h
          </p>
        </Card>
      </div>

      {/* Flagged entries */}
      {flagged.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 mb-3">
            <AlertTriangle size={20} className="text-warning-500" />
            Discrepancies
          </h2>
          <div className="space-y-2">
            {flagged.map((row, i) => (
              <Card key={i} padding="sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-medium text-neutral-900 text-sm">
                    {row.employee}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(row.shift_date).toLocaleDateString("it-IT")}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {row.flags.map((f) => (
                      <Badge
                        key={f}
                        variant={flagLabels[f]?.variant || "warning"}
                      >
                        {flagLabels[f]?.label || f}
                      </Badge>
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-neutral-500">
                    {row.scheduled_hours}h scheduled
                    {row.actual_hours !== null &&
                      ` · ${row.actual_hours}h actual`}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Clean entries */}
      {clean.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 mb-3">
            <CheckCircle size={20} className="text-success-500" />
            On Track
          </h2>
          <div className="space-y-2">
            {clean.slice(0, 20).map((row, i) => (
              <Card key={i} padding="sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700">{row.employee}</span>
                  <span className="text-neutral-500">
                    {new Date(row.shift_date).toLocaleDateString("it-IT")} ·{" "}
                    {row.actual_hours}h
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
