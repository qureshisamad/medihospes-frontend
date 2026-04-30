"use client";

import { Clock, Users } from "lucide-react";
import { format, isPast } from "date-fns";
import type { Shift, ShiftType } from "@/lib/types";

interface ShiftCardProps {
  shift: Shift;
  compact?: boolean;
  onClick: () => void;
}

const shiftTypeStyles: Record<ShiftType, string> = {
  morning: "border-l-[#A16207] bg-[#FEF9C3] text-[#A16207]",
  evening: "border-l-[#BE123C] bg-[#FFE4E6] text-[#BE123C]",
  night: "border-l-[#3730A3] bg-[#E0E7FF] text-[#3730A3]",
};

const shiftTypeMuted: Record<ShiftType, string> = {
  morning: "border-l-[#A16207]/40 bg-neutral-100 text-neutral-500",
  evening: "border-l-[#BE123C]/40 bg-neutral-100 text-neutral-500",
  night: "border-l-[#3730A3]/40 bg-neutral-100 text-neutral-500",
};

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export default function ShiftCard({ shift, compact, onClick }: ShiftCardProps) {
  const isFull = shift.current_bookings >= shift.max_capacity;
  const isPassed = isPast(new Date(shift.start_time));
  const isMuted = isFull || isPassed;

  const styles = isMuted
    ? shiftTypeMuted[shift.shift_type]
    : shiftTypeStyles[shift.shift_type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full min-h-[44px] min-w-[44px] text-left rounded-lg border-l-4 " +
        "transition-shadow duration-150 cursor-pointer " +
        "focus:outline-none focus:ring-2 focus:ring-primary-500/40 " +
        (compact ? "px-1.5 py-1 " : "px-3 py-2 ") +
        styles +
        (isMuted ? " opacity-70" : " hover:shadow-md")
      }
      aria-label={`${shift.shift_type} shift at ${shift.clinic_name ?? "clinic"}, ${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}, ${shift.current_bookings} of ${shift.max_capacity} booked${isFull ? ", full" : ""}${isPassed ? ", past" : ""}`}
    >
      {compact ? (
        /* Compact view for monthly calendar cells */
        <div className="flex items-center gap-1 text-[11px] leading-tight font-medium truncate">
          <span>{formatTime(shift.start_time)}</span>
          {shift.clinic_name && (
            <span className="truncate opacity-80">
              {shift.clinic_name}
            </span>
          )}
          {isFull && (
            <span className="ml-auto shrink-0 rounded bg-neutral-200 px-1 text-[10px] font-semibold text-neutral-600">
              Full
            </span>
          )}
        </div>
      ) : (
        /* Standard view for weekly calendar / detail contexts */
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Clock size={12} className="shrink-0" />
            <span>
              {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            {shift.clinic_name && (
              <span className="truncate font-medium opacity-90">
                {shift.clinic_name}
              </span>
            )}
            <span className="flex items-center gap-0.5 shrink-0">
              <Users size={11} />
              {shift.current_bookings}/{shift.max_capacity}
            </span>
          </div>

          {isFull && (
            <span className="inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              Full
            </span>
          )}
        </div>
      )}
    </button>
  );
}
