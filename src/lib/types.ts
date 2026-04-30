/** Shared TypeScript types matching the backend schemas. */

export type UserRole = "staff" | "admin";
export type ContractType = "part_time" | "full_time";
export type ShiftType = "morning" | "evening" | "night";
export type BookingStatus = "confirmed" | "cancelled";

export interface JobTitleRecord {
  id: number;
  name: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  codice_fiscale: string | null;
  role: UserRole;
  job_title: string;
  contract_type: ContractType;
  weekly_hour_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface Clinic {
  id: number;
  name: string;
  code: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Shift {
  id: number;
  clinic_id: number;
  clinic_name: string | null;
  required_role: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  notes: string | null;
  created_by: number;
  created_at: string;
}

export interface Booking {
  id: number;
  shift_id: number;
  user_id: number;
  status: BookingStatus;
  booked_at: string;
  shift?: Shift;
}

// --- Calendar Shift Management types ---

export type NotificationType = "new_shift" | "booking_confirmed";

export type AttendanceStatus =
  | "not_started"
  | "missing_clock_in"
  | "in_progress"
  | "completed";

export interface BookingDetail {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  job_title: string;
  status: string;
  booked_at: string;
  attendance_status: AttendanceStatus;
  actual_hours: number | null;
}

export interface ShiftDetail extends Shift {
  creator_name: string;
  bookings: BookingDetail[];
}

export interface WeeklyHours {
  week_start: string;
  week_end: string;
  booked_hours: number;
  weekly_hour_limit: number;
  remaining_hours: number;
}

export interface Notification {
  id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_shift_id: number | null;
  is_read: boolean;
  created_at: string;
}
