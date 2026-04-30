"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Filter,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { fetchCalendarShifts } from "@/lib/calendar-api";
import { useAuthStore } from "@/lib/store";
import MonthlyCalendar from "./MonthlyCalendar";
import WeeklyCalendar from "./WeeklyCalendar";
import WeeklyHourIndicator from "./WeeklyHourIndicator";
import ShiftDetailPanel from "./ShiftDetailPanel";
import Button from "@/components/ui/Button";
import type { Shift, Clinic, JobTitleRecord } from "@/lib/types";

type ViewMode = "monthly" | "weekly";

interface CalendarViewProps {
  isAdmin: boolean;
  onShiftClick?: (shift: Shift) => void;
}

export default function CalendarView({ isAdmin }: CalendarViewProps) {
  const { user } = useAuthStore();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter state
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<number | undefined>(
    undefined
  );
  const [selectedRole, setSelectedRole] = useState<string | undefined>(
    undefined
  );

  // Data state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail panel state
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Load clinics and job titles once
  useEffect(() => {
    api
      .get<Clinic[]>("/clinics")
      .then((r) => setClinics(r.data))
      .catch(() => {
        /* clinics filter will just be empty */
      });
    api
      .get<JobTitleRecord[]>("/job-titles?is_active=true")
      .then((r) => setJobTitles(r.data))
      .catch(() => {
        /* job titles filter will just be empty */
      });
  }, []);

  // Compute the date range for the current view
  const { dateFrom, dateTo } = useMemo(() => {
    if (viewMode === "monthly") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      // Extend to full weeks so the grid has data for edge days
      return {
        dateFrom: format(
          startOfWeek(monthStart, { weekStartsOn: 1 }),
          "yyyy-MM-dd'T'HH:mm:ss"
        ),
        dateTo: format(
          endOfWeek(monthEnd, { weekStartsOn: 1 }),
          "yyyy-MM-dd'T'HH:mm:ss"
        ),
      };
    }
    // Weekly
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      dateFrom: format(weekStart, "yyyy-MM-dd'T'HH:mm:ss"),
      dateTo: format(weekEnd, "yyyy-MM-dd'T'HH:mm:ss"),
    };
  }, [viewMode, currentDate]);

  // Fetch shifts when date range or filters change
  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarShifts(
        dateFrom,
        dateTo,
        selectedClinicId,
        selectedRole
      );
      setShifts(data);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedClinicId, selectedRole]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  // Navigation handlers
  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    setCurrentDate((d) =>
      viewMode === "monthly" ? subMonths(d, 1) : subWeeks(d, 1)
    );
  };

  const goNext = () => {
    setCurrentDate((d) =>
      viewMode === "monthly" ? addMonths(d, 1) : addWeeks(d, 1)
    );
  };

  // Shift click handler — opens the detail panel
  const handleShiftClick = (shift: Shift) => {
    setSelectedShiftId(shift.id);
  };

  // Claim handler for staff
  const handleClaim = async () => {
    if (selectedShiftId === null) return;
    setClaiming(true);
    try {
      await api.post(`/shifts/${selectedShiftId}/claim`);
      toast.success("Shift claimed successfully!");
      setSelectedShiftId(null);
      loadShifts();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response
              ?.data?.detail || "Could not claim shift";
      toast.error(message);
    } finally {
      setClaiming(false);
    }
  };

  // Title for the header
  const headerTitle =
    viewMode === "monthly"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy")}`;

  // The week to pass to WeeklyHourIndicator
  const indicatorWeek = useMemo(() => {
    if (viewMode === "weekly") return currentDate;
    // In monthly view, use the current real date for the indicator
    return new Date();
  }, [viewMode, currentDate]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={
              viewMode === "monthly" ? "Previous month" : "Previous week"
            }
          >
            <ChevronLeft size={20} />
          </button>

          <h2 className="text-lg font-semibold text-neutral-900 min-w-[180px] text-center">
            {headerTitle}
          </h2>

          <button
            type="button"
            onClick={goNext}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={
              viewMode === "monthly" ? "Next month" : "Next week"
            }
          >
            <ChevronRight size={20} />
          </button>

          <Button variant="ghost" onClick={goToday} className="ml-1 text-sm">
            Today
          </Button>
        </div>

        {/* Right: view toggle + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] " +
                (viewMode === "monthly"
                  ? "bg-primary-500 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50")
              }
              aria-label="Monthly view"
              aria-pressed={viewMode === "monthly"}
            >
              <CalendarDays size={16} />
              <span className="hidden sm:inline">Month</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              className={
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] " +
                (viewMode === "weekly"
                  ? "bg-primary-500 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50")
              }
              aria-label="Weekly view"
              aria-pressed={viewMode === "weekly"}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Week</span>
            </button>
          </div>

          {/* Clinic filter */}
          <div className="relative">
            <select
              value={selectedClinicId ?? ""}
              onChange={(e) =>
                setSelectedClinicId(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="h-11 rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-700 appearance-none cursor-pointer hover:border-neutral-300 transition-colors"
              aria-label="Filter by clinic"
            >
              <option value="">All clinics</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Filter
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            />
          </div>

          {/* Role filter (admin only) */}
          {isAdmin && (
            <div className="relative">
              <select
                value={selectedRole ?? ""}
                onChange={(e) =>
                  setSelectedRole(e.target.value || undefined)
                }
                className="h-11 rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-700 appearance-none cursor-pointer hover:border-neutral-300 transition-colors"
                aria-label="Filter by role"
              >
                <option value="">All roles</option>
                {jobTitles.map((jt) => (
                  <option key={jt.name} value={jt.name}>
                    {jt.label}
                  </option>
                ))}
              </select>
              <Filter
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Weekly hour indicator for staff users */}
      {!isAdmin && user && <WeeklyHourIndicator weekOf={indicatorWeek} />}

      {/* Calendar body */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      ) : viewMode === "monthly" ? (
        <MonthlyCalendar
          currentDate={currentDate}
          shifts={shifts}
          onShiftClick={handleShiftClick}
        />
      ) : (
        <WeeklyCalendar
          currentDate={currentDate}
          shifts={shifts}
          onShiftClick={handleShiftClick}
        />
      )}

      {/* Shift detail panel */}
      {selectedShiftId !== null && (
        <ShiftDetailPanel
          shiftId={selectedShiftId}
          isAdmin={isAdmin}
          onClose={() => setSelectedShiftId(null)}
          onClaim={!isAdmin ? handleClaim : undefined}
        />
      )}
    </div>
  );
}
