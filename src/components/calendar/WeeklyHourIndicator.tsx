"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { fetchWeeklyHours } from "@/lib/calendar-api";
import type { WeeklyHours } from "@/lib/types";

interface WeeklyHourIndicatorProps {
  weekOf?: Date;
}

/**
 * Progress bar showing booked hours vs. weekly limit.
 * Colors: green (<80%), amber (80–100%), red (at limit).
 */
export default function WeeklyHourIndicator({
  weekOf,
}: WeeklyHourIndicatorProps) {
  const [data, setData] = useState<WeeklyHours | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const weekParam = weekOf ? format(weekOf, "yyyy-MM-dd") : undefined;

    fetchWeeklyHours(weekParam)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekOf?.getTime()]);

  if (loading) {
    return (
      <div className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
    );
  }

  if (error || !data) return null;

  const { booked_hours, weekly_hour_limit, remaining_hours } = data;
  const percentage =
    weekly_hour_limit > 0
      ? Math.min((booked_hours / weekly_hour_limit) * 100, 100)
      : 0;

  // Color thresholds: green <80%, amber 80–<100%, red at 100%
  let barColor: string;
  let textColor: string;
  if (percentage >= 100) {
    barColor = "bg-danger-500";
    textColor = "text-danger-700";
  } else if (percentage >= 80) {
    barColor = "bg-warning-500";
    textColor = "text-warning-700";
  } else {
    barColor = "bg-success-500";
    textColor = "text-success-700";
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-neutral-700">
          <Clock size={14} className="shrink-0" />
          Weekly Hours
        </span>
        <span className={`font-semibold ${textColor}`}>
          {booked_hours.toFixed(1)}h / {weekly_hour_limit.toFixed(1)}h
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={booked_hours}
        aria-valuemin={0}
        aria-valuemax={weekly_hour_limit}
        aria-label={`${booked_hours.toFixed(1)} of ${weekly_hour_limit.toFixed(1)} hours booked`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-xs text-neutral-500">
        {remaining_hours > 0
          ? `${remaining_hours.toFixed(1)}h remaining this week`
          : "Weekly hour limit reached"}
      </p>
    </div>
  );
}
