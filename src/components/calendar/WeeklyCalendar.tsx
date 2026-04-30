"use client";

import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isToday,
  format,
  getHours,
  getMinutes,
  differenceInMinutes,
  startOfDay,
  endOfDay,
} from "date-fns";
import ShiftCard from "./ShiftCard";
import type { Shift } from "@/lib/types";

interface WeeklyCalendarProps {
  currentDate: Date;
  shifts: Shift[];
  onShiftClick: (shift: Shift) => void;
}

/** Hours displayed on the grid (0–23). */
const HOUR_HEIGHT_PX = 60;
const START_HOUR = 0;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

/**
 * Calculate the top offset and height for a shift within the day grid.
 */
function getShiftPosition(shift: Shift, day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const shiftStart = new Date(shift.start_time);
  const shiftEnd = new Date(shift.end_time);

  // Clamp to the visible day boundaries
  const visibleStart = shiftStart < dayStart ? dayStart : shiftStart;
  const visibleEnd = shiftEnd > dayEnd ? dayEnd : shiftEnd;

  const topMinutes = differenceInMinutes(visibleStart, dayStart) - START_HOUR * 60;
  const durationMinutes = differenceInMinutes(visibleEnd, visibleStart);

  const top = (topMinutes / 60) * HOUR_HEIGHT_PX;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT_PX, 28); // min 28px so card is tappable

  return { top, height };
}

/**
 * Groups shifts by their day (YYYY-MM-DD of start_time).
 */
function groupShiftsByDay(shifts: Shift[]): Map<string, Shift[]> {
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

export default function WeeklyCalendar({
  currentDate,
  shifts,
  onShiftClick,
}: WeeklyCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart.getTime(), weekEnd.getTime()]
  );

  const hours = useMemo(
    () =>
      eachHourOfInterval({
        start: new Date(2000, 0, 1, START_HOUR),
        end: new Date(2000, 0, 1, END_HOUR),
      }),
    []
  );

  const shiftsByDay = useMemo(() => groupShiftsByDay(shifts), [shifts]);

  return (
    <>
      {/* Desktop grid (≥640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-200">
            {/* Time gutter header */}
            <div className="py-2" />
            {weekDays.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={
                    "py-2 text-center border-l border-neutral-200 " +
                    (today ? "bg-primary-50" : "")
                  }
                >
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={
                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mt-0.5 " +
                      (today
                        ? "bg-primary-500 text-white"
                        : "text-neutral-900")
                    }
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            className="grid grid-cols-[60px_repeat(7,1fr)] relative"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT_PX }}
          >
            {/* Hour labels in the gutter */}
            {hours.map((hour) => {
              const h = getHours(hour);
              return (
                <div
                  key={h}
                  className="col-start-1 absolute right-0 left-0 border-b border-neutral-100"
                  style={{
                    top: (h - START_HOUR) * HOUR_HEIGHT_PX,
                    height: HOUR_HEIGHT_PX,
                  }}
                >
                  <span className="absolute -top-2.5 left-1.5 text-[11px] text-neutral-400 font-medium">
                    {format(hour, "HH:mm")}
                  </span>
                </div>
              );
            })}

            {/* Day columns with shifts */}
            {weekDays.map((day, colIdx) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayShifts = shiftsByDay.get(dateKey) ?? [];
              const today = isToday(day);

              return (
                <div
                  key={dateKey}
                  className={
                    "relative border-l border-neutral-200 " +
                    (today ? "bg-primary-50/30" : "")
                  }
                  style={{
                    gridColumn: colIdx + 2,
                    gridRow: 1,
                    height: TOTAL_HOURS * HOUR_HEIGHT_PX,
                  }}
                >
                  {/* Hour gridlines */}
                  {hours.map((hour) => (
                    <div
                      key={getHours(hour)}
                      className="absolute inset-x-0 border-b border-neutral-100"
                      style={{
                        top: (getHours(hour) - START_HOUR) * HOUR_HEIGHT_PX,
                        height: HOUR_HEIGHT_PX,
                      }}
                    />
                  ))}

                  {/* Positioned shift cards */}
                  {dayShifts.map((shift) => {
                    const { top, height } = getShiftPosition(shift, day);
                    return (
                      <div
                        key={shift.id}
                        className="absolute inset-x-1 z-10"
                        style={{ top, height }}
                      >
                        <ShiftCard
                          shift={shift}
                          onClick={() => onShiftClick(shift)}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile vertical timeline (<640px) */}
      <div className="sm:hidden space-y-4">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayShifts = shiftsByDay.get(dateKey) ?? [];
          const today = isToday(day);

          return (
            <div key={dateKey}>
              {/* Day header */}
              <div
                className={
                  "flex items-center gap-2 px-1 py-1.5 sticky top-0 bg-background z-10 " +
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

              {/* Shifts as a vertical scrollable list */}
              {dayShifts.length > 0 ? (
                <div className="space-y-1.5 pl-10">
                  {dayShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      onClick={() => onShiftClick(shift)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400 pl-10 py-1">
                  No shifts
                </p>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {shifts.length === 0 && (
          <p className="text-center text-sm text-neutral-500 py-8">
            No shifts this week.
          </p>
        )}
      </div>
    </>
  );
}
