"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, X } from "lucide-react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  ABSENCE_LABELS,
  type AbsenceCode,
  type Department,
  type Employee,
  type RosterCell,
  type ShiftTypeDef,
  type SubstituteCandidate,
} from "@/lib/types";

const ABSENCE_CODES = Object.keys(ABSENCE_LABELS) as AbsenceCode[];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function RosterPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<number | "">("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeDef[]>([]);
  const [cells, setCells] = useState<RosterCell[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<{ emp: Employee; day: number } | null>(
    null
  );

  const days = useMemo(() => {
    const n = daysInMonth(year, month);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [year, month]);

  const loadRoster = useCallback(() => {
    setLoading(true);
    const params: Record<string, unknown> = { year, month };
    if (departmentId !== "") params.department_id = departmentId;
    Promise.all([
      api.get("/employees", {
        params: { is_active: true, ...(departmentId !== "" ? { department_id: departmentId } : {}) },
      }),
      api.get("/roster", { params }),
    ])
      .then(([e, r]) => {
        setEmployees(e.data);
        setCells(r.data);
      })
      .catch(() => toast.error("Failed to load roster"))
      .finally(() => setLoading(false));
  }, [year, month, departmentId]);

  useEffect(() => {
    api.get("/departments").then((r) => setDepartments(r.data)).catch(() => {});
    api
      .get("/shift-types", { params: { is_active: true } })
      .then((r) => setShiftTypes(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const shiftCode = (id: number | null) =>
    shiftTypes.find((s) => s.id === id)?.code ?? "?";

  const cellMap = useMemo(() => {
    const m = new Map<string, RosterCell>();
    for (const c of cells) {
      const day = parseInt(c.work_date.slice(8, 10), 10);
      m.set(`${c.employee_id}-${day}`, c);
    }
    return m;
  }, [cells]);

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const download = async (fmt: "xlsx" | "pdf") => {
    try {
      const res = await api.get(`/reports/roster.${fmt}`, {
        params: {
          year,
          month,
          ...(departmentId !== "" ? { department_id: departmentId } : {}),
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `roster_${year}_${String(month).padStart(2, "0")}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Monthly Roster</h1>
          <p className="mt-1 text-neutral-500">
            Click any cell to assign a shift or absence
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download("xlsx")}>
            <Download size={16} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => download("pdf")}>
            <Download size={16} /> PDF
          </Button>
        </div>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            translate="no"
            className="notranslate h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) =>
              setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100 animate-pulse" />
      ) : employees.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">
            No employees to schedule. Add employees first.
          </p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white border-b border-neutral-200 px-2 py-2 text-left font-semibold min-w-[160px]">
                  Employee
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="border-b border-neutral-200 px-1 py-2 text-center font-medium text-neutral-600 w-8"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-neutral-50">
                  <td className="sticky left-0 z-10 bg-white border-b border-neutral-100 px-2 py-1.5 whitespace-nowrap">
                    <span className="font-medium text-neutral-900">
                      {emp.last_name} {emp.first_name}
                    </span>
                    <span className="block text-[10px] text-neutral-400 capitalize">
                      {emp.job_title}
                    </span>
                  </td>
                  {days.map((d) => {
                    const cell = cellMap.get(`${emp.id}-${d}`);
                    const label = cell
                      ? cell.shift_type_id
                        ? shiftCode(cell.shift_type_id)
                        : cell.absence_code
                      : "";
                    const isAbsence = !!cell?.absence_code;
                    return (
                      <td
                        key={d}
                        onClick={() => setEditing({ emp, day: d })}
                        className={
                          "border-b border-l border-neutral-100 text-center cursor-pointer h-8 " +
                          (isAbsence
                            ? "bg-warning-50 text-warning-700 font-semibold"
                            : label
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "hover:bg-primary-50/50")
                        }
                        title={
                          cell?.substitutes_for_id
                            ? "Substitution"
                            : undefined
                        }
                      >
                        {label}
                        {cell?.substitutes_for_id ? "*" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <CellEditor
          employee={editing.emp}
          dateStr={dateStr(editing.day)}
          shiftTypes={shiftTypes}
          existing={cellMap.get(`${editing.emp.id}-${editing.day}`) ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadRoster();
          }}
        />
      )}
    </div>
  );
}

function CellEditor({
  employee,
  dateStr,
  shiftTypes,
  existing,
  onClose,
  onSaved,
}: {
  employee: Employee;
  dateStr: string;
  shiftTypes: ShiftTypeDef[];
  existing: RosterCell | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subs, setSubs] = useState<SubstituteCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.put("/roster/cell", {
        employee_id: employee.id,
        work_date: dateStr,
        ...payload,
      });
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await api.delete("/roster/cell", {
        params: { employee_id: employee.id, work_date: dateStr },
      });
      toast.success("Cleared");
      onSaved();
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const loadSubs = async () => {
    try {
      const res = await api.get("/roster/substitutes", {
        params: {
          role: employee.job_title,
          work_date: dateStr,
          exclude_employee_id: employee.id,
        },
      });
      setSubs(res.data);
    } catch {
      toast.error("Could not load substitutes");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {employee.last_name} {employee.first_name}
            </h3>
            <p className="text-sm text-neutral-500">{dateStr}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={20} />
          </button>
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          Shift
        </p>
        <div className="flex flex-wrap gap-2">
          {shiftTypes.map((s) => (
            <button
              key={s.id}
              disabled={saving}
              onClick={() => save({ shift_type_id: s.id })}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium " +
                (existing?.shift_type_id === s.id
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-neutral-300 hover:bg-neutral-50")
              }
              title={`${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} (${s.duration_hours}h)`}
            >
              {s.code}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          Absence
        </p>
        <div className="flex flex-wrap gap-2">
          {ABSENCE_CODES.map((code) => (
            <button
              key={code}
              disabled={saving}
              onClick={() => save({ absence_code: code })}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium " +
                (existing?.absence_code === code
                  ? "border-warning-700 bg-warning-50 text-warning-700"
                  : "border-neutral-300 hover:bg-neutral-50")
              }
              title={ABSENCE_LABELS[code]}
            >
              {code}
            </button>
          ))}
        </div>

        {/* Human-in-the-loop substitution helper */}
        <div className="mt-5 border-t border-neutral-200 pt-4">
          <button
            onClick={loadSubs}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Find available substitutes ({employee.job_title})
          </button>
          {subs && (
            <div className="mt-3 space-y-2">
              {subs.length === 0 && (
                <p className="text-sm text-neutral-500">
                  No eligible, available substitutes for this date.
                </p>
              )}
              {subs.map((s) => (
                <div
                  key={s.employee_id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{s.name}</span>
                    {s.is_cross_role && (
                      <span className="ml-2 text-[10px] text-info-500">
                        cross-role
                      </span>
                    )}
                    <span className="block text-[11px] text-neutral-400">
                      {s.remaining_hours}h left
                      {s.would_cause_overtime ? " · would cause overtime" : ""}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {s.job_title}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-neutral-400 pt-1">
                Suggestions only — assign the chosen substitute manually on their
                own row.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {existing && (
            <Button variant="danger" onClick={clear} loading={saving}>
              Clear cell
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
