/** Shared TypeScript types matching the v2 backend schemas. */

export type UserRole = "manager" | "hr";
export type ContractType = "part_time" | "full_time";

/** Absence / substitution category codes (req v2.0 §1.5). */
export type AbsenceCode = "B" | "B1" | "B2" | "C1" | "C2" | "SOL";

export const ABSENCE_LABELS: Record<AbsenceCode, string> = {
  B: "Vacation",
  B1: "Sick leave",
  B2: "Temp transfer",
  C1: "Fixed sub",
  C2: "Variable sub",
  SOL: "Solidarity (20H)",
};

/** Kept for the Badge component (shift codes are free-form strings now). */
export type ShiftType = string;

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface JobTitleRecord {
  id: number;
  name: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface Site {
  id: number;
  name: string;
  code: string;
  address: string | null;
}

export interface ShiftTypeDef {
  id: number;
  code: string;
  name: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  duration_hours: number;
  crosses_midnight: boolean;
  notes: string | null;
  is_active: boolean;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  codice_fiscale: string | null;
  department_id: number;
  site_id: number | null;
  job_title: string;
  location: string | null;
  contract_type: ContractType;
  monthly_hour_limit: number;
  flexible_shift: boolean;
  flexible_location: boolean;
  is_active: boolean;
  created_at: string;
  coverable_roles: string[];
}

export interface RosterCell {
  id: number;
  employee_id: number;
  work_date: string; // YYYY-MM-DD
  shift_type_id: number | null;
  absence_code: AbsenceCode | null;
  site_id: number | null;
  substitutes_for_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface SubstituteCandidate {
  employee_id: number;
  name: string;
  job_title: string;
  is_cross_role: boolean;
  is_cross_site: boolean;
  on_rest: boolean;
  booked_hours: number;
  monthly_hour_limit: number;
  remaining_hours: number;
  would_cause_overtime: boolean;
}

export interface CoverageItem {
  shift_type_id: number;
  required_count: number;
}

export interface RotationPattern {
  id: number;
  name: string;
  job_title: string;
  site_id: number | null;
  site_name: string | null;
  is_active: boolean;
  shift_type_ids: number[];
  min_rest_hours: number;
  coverage: CoverageItem[];
}

export interface AutoFillResult {
  filled_cells: number;
  employees_filled: number;
  skipped: string[];
  warnings: string[];
  unmet: string[];
  alerts: string[];
}

export interface ChangeLogEntry {
  id: number;
  action: string;
  employee_name: string | null;
  work_date: string | null;
  detail: string;
  changed_at: string;
}

export interface EmployeeHours {
  employee_id: number;
  name: string;
  job_title: string;
  department: string;
  contract_type: string;
  monthly_hour_limit: number;
  worked_hours: number;
  overtime_hours: number;
  remaining_hours: number;
  utilisation_pct: number;
  approaching_limit: boolean;
  over_limit: boolean;
}
