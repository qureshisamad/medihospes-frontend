"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Clock,
  MapPin,
  Users,
  Briefcase,
  FileText,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fetchShiftDetails } from "@/lib/calendar-api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type {
  Shift,
  ShiftDetail,
  BookingDetail,
  AttendanceStatus,
} from "@/lib/types";

interface ShiftDetailPanelProps {
  shiftId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onClaim?: () => void;
}

const attendanceBadge: Record<
  AttendanceStatus,
  { label: string; variant: "default" | "danger" | "info" | "success" }
> = {
  not_started: { label: "Not started", variant: "default" },
  missing_clock_in: { label: "Missing clock-in", variant: "danger" },
  in_progress: { label: "In progress", variant: "info" },
  completed: { label: "Completed", variant: "success" },
};

function formatDateTime(iso: string): string {
  return format(new Date(iso), "EEE d MMM yyyy, HH:mm");
}

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export default function ShiftDetailPanel({
  shiftId,
  isAdmin,
  onClose,
  onClaim,
}: ShiftDetailPanelProps) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (shiftId === null) return;
    if (!isAdmin) return; // staff view doesn't need the detail endpoint
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShiftDetails(shiftId);
      setDetail(data);
    } catch {
      setError("Failed to load shift details.");
    } finally {
      setLoading(false);
    }
  }, [shiftId, isAdmin]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (shiftId === null) return null;

  // For staff view we receive shift data via the parent (CalendarView passes it).
  // For admin view we fetch ShiftDetail from the API.
  // The panel renders based on what's available.

  const shift: Shift | ShiftDetail | null = detail;
  const isFull = shift
    ? shift.current_bookings >= shift.max_capacity
    : false;
  const isPassed = shift
    ? new Date(shift.start_time) <= new Date()
    : false;
  const canClaim = !isAdmin && !isFull && !isPassed && !!onClaim;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — side panel on desktop, full-screen sheet on mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shift details"
        className={
          "fixed z-50 bg-white shadow-xl transition-transform duration-200 " +
          "flex flex-col overflow-hidden " +
          /* Mobile: full-screen slide-up sheet */
          "inset-x-0 bottom-0 top-12 rounded-t-2xl " +
          /* Desktop (≥640px): side panel on the right */
          "sm:inset-y-0 sm:top-0 sm:left-auto sm:right-0 sm:w-[420px] sm:max-w-full sm:rounded-t-none sm:rounded-l-2xl"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Shift Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-neutral-100 animate-pulse"
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-danger-500">{error}</p>
          )}

          {!loading && !error && shift && (
            <>
              {/* Shift info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge shiftType={shift.shift_type}>
                    {shift.shift_type}
                  </Badge>
                  <Badge variant="default">{shift.required_role}</Badge>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="flex items-center gap-1.5 text-neutral-500">
                    <Clock size={16} /> Time
                  </dt>
                  <dd className="text-neutral-900 font-medium">
                    {formatDateTime(shift.start_time)} –{" "}
                    {formatTime(shift.end_time)}
                  </dd>

                  {shift.clinic_name && (
                    <>
                      <dt className="flex items-center gap-1.5 text-neutral-500">
                        <MapPin size={16} /> Clinic
                      </dt>
                      <dd className="text-neutral-900">{shift.clinic_name}</dd>
                    </>
                  )}

                  <dt className="flex items-center gap-1.5 text-neutral-500">
                    <Users size={16} /> Capacity
                  </dt>
                  <dd className="text-neutral-900">
                    {shift.current_bookings} / {shift.max_capacity}
                    {isFull && (
                      <span className="ml-2 text-xs font-medium text-neutral-500">
                        (Full)
                      </span>
                    )}
                  </dd>

                  {shift.notes && (
                    <>
                      <dt className="flex items-center gap-1.5 text-neutral-500">
                        <FileText size={16} /> Notes
                      </dt>
                      <dd className="text-neutral-700">{shift.notes}</dd>
                    </>
                  )}

                  {isAdmin && detail?.creator_name && (
                    <>
                      <dt className="flex items-center gap-1.5 text-neutral-500">
                        <User size={16} /> Created by
                      </dt>
                      <dd className="text-neutral-900">
                        {detail.creator_name}
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              {/* Admin: bookings list */}
              {isAdmin && detail && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Bookings ({detail.bookings.length})
                  </h3>

                  {detail.bookings.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No bookings yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.bookings.map((b: BookingDetail) => {
                        const badge = attendanceBadge[b.attendance_status];
                        return (
                          <li
                            key={b.id}
                            className="rounded-lg border border-neutral-200 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-neutral-900">
                                {b.first_name} {b.last_name}
                              </span>
                              <Badge variant={badge.variant}>
                                {badge.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <span className="flex items-center gap-1">
                                <Briefcase size={12} />
                                {b.job_title}
                              </span>
                              <span>
                                Booked{" "}
                                {format(new Date(b.booked_at), "d MMM, HH:mm")}
                              </span>
                              {b.attendance_status === "completed" &&
                                b.actual_hours !== null && (
                                  <span className="ml-auto font-medium text-success-700">
                                    {b.actual_hours.toFixed(1)}h
                                  </span>
                                )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — Claim button for staff */}
        {canClaim && (
          <div className="border-t border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
            <Button onClick={onClaim} className="w-full">
              Claim Shift
            </Button>
          </div>
        )}

        {/* Footer — Full indicator for staff when shift is full */}
        {!isAdmin && isFull && (
          <div className="border-t border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
            <Button variant="secondary" disabled className="w-full">
              Full
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
