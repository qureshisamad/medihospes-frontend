"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Users } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { EmployeeHours } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [hours, setHours] = useState<EmployeeHours[]>([]);
  const [empCount, setEmpCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/roster/hours", { params: { year, month } }),
      api.get("/employees", { params: { is_active: true } }),
    ])
      .then(([h, e]) => {
        setHours(h.data);
        setEmpCount(e.data.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  const alerts = hours.filter((h) => h.approaching_limit || h.over_limit);
  const monthName = now.toLocaleDateString("en-GB", { month: "long" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Welcome, {user?.first_name}
        </h1>
        <p className="mt-1 text-neutral-500">
          {monthName} {year} overview
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Active Employees
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{empCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Hour Alerts
          </p>
          <p className="mt-2 text-2xl font-bold text-warning-700">
            {alerts.length}
          </p>
          <p className="text-sm text-neutral-500">approaching / over limit</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            Overtime (ORE SUPP.)
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">
            {hours.reduce((s, h) => s + h.overtime_hours, 0).toFixed(1)}h
          </p>
        </Card>
      </div>

      {/* Overtime / limit alerts (human-in-the-loop: surfaced, never acted on) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-warning-700" />
          <h2 className="text-lg font-semibold text-neutral-900">
            Hour Limit Alerts
          </h2>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
        ) : alerts.length === 0 ? (
          <Card>
            <p className="text-center text-neutral-500 py-6">
              No employees near their monthly limit.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((h) => (
              <Card key={h.employee_id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-neutral-900">
                      {h.name}
                    </span>
                    <Badge variant={h.over_limit ? "danger" : "warning"}>
                      {h.over_limit ? "Over limit" : "Approaching"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {h.worked_hours}h worked of {h.monthly_hour_limit}h
                    {h.overtime_hours > 0 &&
                      ` · ${h.overtime_hours}h overtime`}
                  </p>
                </div>
                <div className="text-sm font-semibold text-neutral-700">
                  {h.utilisation_pct}%
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/roster">
            <Card className="hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-primary-500" />
                <span className="text-sm font-medium text-neutral-900">
                  Open Monthly Roster
                </span>
              </div>
            </Card>
          </Link>
          <Link href="/employees">
            <Card className="hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-primary-500" />
                <span className="text-sm font-medium text-neutral-900">
                  Manage Employees
                </span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
