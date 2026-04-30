/**
 * API helpers for the calendar shift management feature.
 * All functions use the shared Axios instance from ./api.
 */

import api from "./api";
import type { Shift, ShiftDetail, WeeklyHours, Notification } from "./types";

/**
 * Fetch shifts within a date range for calendar rendering.
 *
 * @param dateFrom - ISO date string for range start
 * @param dateTo   - ISO date string for range end
 * @param clinicId - Optional clinic filter
 * @param role     - Optional required_role filter
 */
export async function fetchCalendarShifts(
  dateFrom: string,
  dateTo: string,
  clinicId?: number,
  role?: string
): Promise<Shift[]> {
  const params: Record<string, string | number> = {
    date_from: dateFrom,
    date_to: dateTo,
  };
  if (clinicId !== undefined) params.clinic_id = clinicId;
  if (role !== undefined) params.role = role;

  const { data } = await api.get<Shift[]>("/shifts/calendar", { params });
  return data;
}

/**
 * Fetch full shift details including bookings and attendance (admin only).
 */
export async function fetchShiftDetails(
  shiftId: number
): Promise<ShiftDetail> {
  const { data } = await api.get<ShiftDetail>(`/shifts/${shiftId}/details`);
  return data;
}

/**
 * Fetch the authenticated user's weekly hours summary.
 *
 * @param weekOf - Optional ISO date string; defaults to current week on the server
 */
export async function fetchWeeklyHours(
  weekOf?: string
): Promise<WeeklyHours> {
  const params: Record<string, string> = {};
  if (weekOf !== undefined) params.week_of = weekOf;

  const { data } = await api.get<WeeklyHours>("/shifts/weekly-hours", {
    params,
  });
  return data;
}

/**
 * Fetch unread notifications for the authenticated user.
 */
export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>("/notifications");
  return data;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}
