"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, History, Repeat, X } from "lucide-react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  ABSENCE_LABELS,
  type AbsenceCode,
  type AutoFillResult,
  type ChangeLogEntry,
  type Department,
  type Employee,
  type JobTitleRecord,
  type RosterCell,
  type RotationPattern,
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
  const [jobTitle, setJobTitle] = useState<string>("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [rotations, setRotations] = useState<RotationPattern[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeDef[]>([]);
  const [cells, setCells] = useState<RosterCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [editing, setEditing] = useState<{ emp: Employee; day: number } | null>(
    null
  );

  const days = useMemo(() => {
    const n = daysInMonth(year, month);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [year, month]);

  const loadRoster = useCallback(() => {
    setLoading(true);
    const scope = {
      ...(departmentId !== "" ? { department_id: departmentId } : {}),
      ...(jobTitle !== "" ? { job_title: jobTitle } : {}),
    };
    Promise.all([
      api.get("/employees", { params: { is_active: true, ...scope } }),
      api.get("/roster", { params: { year, month, ...scope } }),
    ])
      .then(([e, r]) => {
        setEmployees(e.data);
        setCells(r.data);
      })
      .catch(() => toast.error("Failed to load roster"))
      .finally(() => setLoading(false));
  }, [year, month, departmentId, jobTitle]);

  useEffect(() => {
    api.get("/departments").then((r) => setDepartments(r.data)).catch(() => {});
    api
      .get("/job-titles", { params: { is_active: true } })
      .then((r) => setJobTitles(r.data))
      .catch(() => {});
    api
      .get("/rotations", { params: { is_active: true } })
      .then((r) => setRotations(r.data))
      .catch(() => {});
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
          <Button onClick={() => setShowAutoFill(true)}>
            <Repeat size={16} /> Auto-fill from rotation
          </Button>
          <Button variant="secondary" onClick={() => setShowHistory(true)}>
            <History size={16} /> History
          </Button>
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
          <select
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            <option value="">All categories</option>
            {jobTitles.map((j) => (
              <option key={j.id} value={j.name}>{j.label}</option>
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

      {showAutoFill && (
        <AutoFillModal
          rotations={rotations}
          shiftTypes={shiftTypes}
          jobTitles={jobTitles}
          year={year}
          month={month}
          monthLabel={months[month - 1]}
          departmentId={departmentId}
          activeJobTitle={jobTitle}
          onClose={() => setShowAutoFill(false)}
          onReload={loadRoster}
        />
      )}

      {editing && (
        <CellEditor
          employee={editing.emp}
          dateStr={dateStr(editing.day)}
          shiftTypes={shiftTypes}
          rotations={rotations}
          existing={cellMap.get(`${editing.emp.id}-${editing.day}`) ?? null}
          onClose={() => setEditing(null)}
          onReload={loadRoster}
          onDone={() => {
            setEditing(null);
            loadRoster();
          }}
        />
      )}

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function CellEditor({
  employee,
  dateStr,
  shiftTypes,
  rotations,
  existing,
  onClose,
  onReload,
  onDone,
}: {
  employee: Employee;
  dateStr: string;
  shiftTypes: ShiftTypeDef[];
  rotations: RotationPattern[];
  existing: RosterCell | null;
  onClose: () => void;
  onReload: () => void;
  onDone: () => void;
}) {
  const [subs, setSubs] = useState<SubstituteCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  // The rotation pattern for this employee's category (for propagation).
  const pattern = rotations.find(
    (r) => r.job_title === employee.job_title && r.is_active
  );
  const [yy, mm] = dateStr.split("-").map(Number);

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      await api.put("/roster/cell", {
        employee_id: employee.id,
        work_date: dateStr,
        ...payload,
      });
      toast.success("Saved");
      setSavedOnce(true);
      onReload(); // refresh grid behind; keep editor open for propagation
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const autoUpdateMonth = async () => {
    if (!pattern) return;
    setSaving(true);
    try {
      const res = await api.post("/roster/auto-fill", {
        year: yy,
        month: mm,
        pattern_id: pattern.id,
      });
      const r = res.data as AutoFillResult;
      toast.success(`Re-balanced — ${r.filled_cells} cells updated.`);
      if (r.unmet?.length) {
        toast(`${r.unmet.length} slot(s) left unfilled — see Auto-fill report.`, {
          icon: "⚠️",
        });
      }
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Update failed");
      setSaving(false);
    }
  };

  const cascadePerson = async () => {
    if (!pattern) return;
    setSaving(true);
    try {
      const res = await api.post("/roster/cascade", {
        employee_id: employee.id,
        work_date: dateStr,
        pattern_id: pattern.id,
      });
      toast.success(`Updated ${res.data.updated} of this person's later day(s).`);
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Update failed");
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
      onDone();
    } catch {
      toast.error("Failed");
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

        {savedOnce && pattern && (
          <div className="mt-5 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
            <p className="text-sm font-medium text-neutral-800">
              Apply this change to the rest of the schedule?
            </p>
            <p className="mb-3 text-xs text-neutral-500">
              Your manual change is locked and will be kept either way.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={cascadePerson}
                loading={saving}
              >
                Update {employee.first_name}&apos;s later days only
              </Button>
              <Button
                variant="secondary"
                onClick={autoUpdateMonth}
                loading={saving}
              >
                Auto-update the whole month (re-balance everyone)
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            {savedOnce ? "Done — keep rest unchanged" : "Close"}
          </Button>
          {existing && !savedOnce && (
            <Button variant="danger" onClick={clear} loading={saving}>
              Clear cell
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function AutoFillModal({
  rotations,
  shiftTypes,
  jobTitles,
  year,
  month,
  monthLabel,
  departmentId,
  activeJobTitle,
  onClose,
  onReload,
}: {
  rotations: RotationPattern[];
  shiftTypes: ShiftTypeDef[];
  jobTitles: JobTitleRecord[];
  year: number;
  month: number;
  monthLabel: string;
  departmentId: number | "";
  activeJobTitle: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [autoStagger, setAutoStagger] = useState(true);
  const [result, setResult] = useState<AutoFillResult | null>(null);

  const codeOf = (id: number) => shiftTypes.find((s) => s.id === id)?.code ?? "?";
  const labelOf = (jt: string) =>
    jobTitles.find((j) => j.name === jt)?.label ?? jt;

  // Show the rotation(s) for the active category first, if one is filtered.
  const ordered = [...rotations].sort((a, b) =>
    a.job_title === activeJobTitle ? -1 : b.job_title === activeJobTitle ? 1 : 0
  );

  const run = async (pattern: RotationPattern) => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post("/roster/auto-fill", {
        year,
        month,
        pattern_id: pattern.id,
        auto_stagger: autoStagger,
        ...(departmentId !== "" ? { department_id: departmentId } : {}),
      });
      const r = res.data as AutoFillResult;
      setResult(r);
      if (r.employees_filled === 0) {
        toast.error("No employees were scheduled for this category.");
      } else {
        toast.success(
          `Filled ${r.filled_cells} cells for ${r.employees_filled} employee(s).`
        );
      }
      onReload(); // refresh the grid behind the modal
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Auto-fill failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              Auto-fill {monthLabel} {year}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Fills the whole month for the category, respecting contract hours
              and rest between shifts. Absences you&apos;ve entered are kept and
              every cell stays editable afterwards.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        {ordered.some((p) => p.coverage.length === 0) && (
          <label className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={autoStagger}
              onChange={(e) => setAutoStagger(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-neutral-800">
                Stagger starts automatically
              </span>
              <span className="block text-xs text-neutral-500">
                Only used for cycle rotations that have no coverage defined.
                Gives each employee a different starting shift.
              </span>
            </span>
          </label>
        )}

        <div className="mt-4 space-y-3">
          {ordered.length === 0 && (
            <p className="text-sm text-neutral-500">
              No rotation libraries defined yet. Create one under{" "}
              <b>Rotations</b>.
            </p>
          )}
          {ordered.map((p) => {
            const coverageMode = p.coverage.length > 0;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-neutral-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-neutral-900">{p.name}</div>
                    <div className="text-xs text-neutral-500">
                      {labelOf(p.job_title)}
                      {coverageMode && ` · min rest ${p.min_rest_hours}h`}
                    </div>
                  </div>
                  <Button
                    onClick={() => run(p)}
                    loading={running}
                    disabled={running}
                  >
                    Fill month
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {coverageMode ? (
                    <>
                      {p.coverage.map((c, i) => (
                        <span
                          key={i}
                          className="rounded bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700"
                        >
                          {c.required_count}× {codeOf(c.shift_type_id)}
                        </span>
                      ))}
                      <span className="ml-1 text-[11px] text-neutral-400">
                        (daily coverage)
                      </span>
                    </>
                  ) : (
                    <>
                      {p.shift_type_ids.map((id, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-neutral-300">→</span>}
                          <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                            {codeOf(id)}
                          </span>
                        </span>
                      ))}
                      <span className="ml-1 text-[11px] text-neutral-400">
                        ({p.shift_type_ids.length}-day cycle)
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {result && (
          <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
            <div className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              Filled <b>{result.filled_cells}</b> cells for{" "}
              <b>{result.employees_filled}</b> employee(s).
            </div>

            {result.unmet.length > 0 && (
              <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
                <div className="font-medium">
                  {result.unmet.length} shift slot(s) could not be staffed within
                  the rest / hour rules — fill these manually:
                </div>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs">
                  {result.unmet.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                <ul className="list-disc pl-5">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="text-xs text-neutral-500">
                Skipped (no day-1 shift): {result.skipped.join(", ")}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  manual_set: "Manual edit",
  manual_clear: "Cleared",
  auto_fill: "Auto-fill",
  cascade: "Cascade",
};

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null);

  useEffect(() => {
    api
      .get("/roster/history", { params: { limit: 150 } })
      .then((r) => setEntries(r.data))
      .catch(() => toast.error("Could not load history"));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              Change history
            </h3>
            <p className="text-sm text-neutral-500">
              Recent roster modifications, most recent first.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4">
          {entries === null ? (
            <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No changes recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="mt-0.5 shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-neutral-800">
                      {e.employee_name && (
                        <span className="font-medium">{e.employee_name} · </span>
                      )}
                      {e.detail}
                      {e.work_date && (
                        <span className="text-neutral-400"> ({e.work_date})</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {new Date(e.changed_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}
