"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import ShiftCard from "./ShiftCard";
import type { Shift } from "@/lib/types";

interface MonthlyCalendarProps {
  currentDate: Date;
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Groups shifts by their date string (YYYY-MM-DD) for efficient lookup.
 */
function groupShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = format(new Date(shift.start_time), "yyyy-MM-dd");
    const existing = map.get(key);
    if (existing) {
      existing.push(shift);
    } else {
      map.set(key, [shift]);
    }
  }
  return map;
}

export default function MonthlyCalendar({
  currentDate,
  shifts,
  onShiftClick,
}: MonthlyCalendarProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Build the full grid: start from Monday of the week containing the 1st,
  // end on Sunday of the week containing the last day.
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      }),
    [monthStart.getTime(), monthEnd.getTime()]
  );

  const shiftsByDate = useMemo(() => groupShiftsByDate(shifts), [shifts]);

  return (
    <>
      {/* Desktop grid (≥640px) */}
      <div className="hidden sm:block">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-neutral-200">
          {DAY_HEADERS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const dateKey = format(day, "yyyy-MM-dd");
            const dayShifts = shiftsByDate.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className={
                  "min-h-[100px] border-b border-r border-neutral-200 p-1.5 " +
                  (inMonth ? "" : "bg-neutral-50 ")
                }
              >
                {/* Day number */}
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={
                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium " +
                      (today
                        ? "bg-primary-500 text-white "
                        : inMonth
                          ? "text-neutral-900 "
                          : "text-neutral-400 ")
                    }
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Shift cards */}
                <div className="space-y-0.5">
                  {dayShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      compact
                      onClick={() => onShiftClick(shift)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile list (<640px) — compact date-grouped list */}
      <div className="sm:hidden space-y-3">
        {calendarDays
          .filter((day) => isSameMonth(day, currentDate))
          .map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayShifts = shiftsByDate.get(dateKey) ?? [];
            const today = isToday(day);

            // Skip days with no shifts on mobile for a cleaner view
            if (dayShifts.length === 0) return null;

            return (
              <div key={dateKey}>
                {/* Date header */}
                <div
                  className={
                    "flex items-center gap-2 px-1 py-1.5 " +
                    (today ? "text-primary-600" : "text-neutral-700")
                  }
                >
                  <span
                    className={
                      "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold " +
                      (today
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 text-neutral-700")
                    }
                  >
                    {format(day, "d")}
                  </span>
                  <span className="text-sm font-medium">
                    {format(day, "EEEE, d MMMM")}
                  </span>
                </div>

                {/* Shift cards for this day */}
                <div className="space-y-1.5 pl-10">
                  {dayShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      compact={false}
                      onClick={() => onShiftClick(shift)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

        {/* Empty state when no shifts exist in the month */}
        {shifts.length === 0 && (
          <p className="text-center text-sm text-neutral-500 py-8">
            No shifts this month.
          </p>
        )}
      </div>
    </>
  );
}
