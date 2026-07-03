"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, History, Repeat, Trash2, X } from "lucide-react";
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
  type Site,
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
  const [siteId, setSiteId] = useState<number | "">("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [rotations, setRotations] = useState<RotationPattern[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeDef[]>([]);
  const [cells, setCells] = useState<RosterCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClear, setShowClear] = useState(false);

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
      ...(siteId !== "" ? { site_id: siteId } : {}),
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
  }, [year, month, departmentId, jobTitle, siteId]);

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
    api.get("/sites").then((r) => setSites(r.data)).catch(() => {});
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

  // --- Per-day coverage status (green OK / yellow incomplete / red excessive) ---
  // Coverage is judged PER HOUSE (job_title + site) so a duplicate in one house
  // never mis-flags a legitimate cell in another.
  const patternByEmp = useMemo(() => {
    const m = new Map<number, RotationPattern | null>();
    for (const e of employees) {
      const p =
        rotations.find(
          (r) =>
            r.is_active &&
            r.coverage.length > 0 &&
            r.job_title === e.job_title &&
            r.site_id === e.site_id
        ) ??
        rotations.find(
          (r) =>
            r.is_active &&
            r.coverage.length > 0 &&
            r.job_title === e.job_title &&
            r.site_id === null
        ) ??
        null;
      m.set(e.id, p);
    }
    return m;
  }, [employees, rotations]);

  const hasCoverage = useMemo(
    () => [...patternByEmp.values()].some((p) => p != null),
    [patternByEmp]
  );

  // Per-day: status, which shifts are over/under, and which employee cells are
  // duplicates (over their required count within their own house).
  const coverageByDay = useMemo(() => {
    const map = new Map<
      number,
      {
        status: "ok" | "under" | "over";
        overCodes: string[];
        underCodes: string[];
        overEmpIds: Set<number>;
      }
    >();
    if (!hasCoverage) return map;
    // group visible employees by their house rotation
    const groups = new Map<number, { pattern: RotationPattern; emps: Employee[] }>();
    for (const e of employees) {
      const p = patternByEmp.get(e.id);
      if (!p) continue;
      if (!groups.has(p.id)) groups.set(p.id, { pattern: p, emps: [] });
      groups.get(p.id)!.emps.push(e);
    }
    for (const day of days) {
      let over = false;
      let under = false;
      const overCodes = new Set<string>();
      const underCodes = new Set<string>();
      const overEmpIds = new Set<number>();
      for (const { pattern, emps } of groups.values()) {
        const req = new Map(
          pattern.coverage.map((c) => [c.shift_type_id, c.required_count])
        );
        const holders = new Map<number, number[]>(); // shift -> empIds
        for (const e of emps) {
          const sid = cellMap.get(`${e.id}-${day}`)?.shift_type_id;
          if (sid != null && req.has(sid)) {
            if (!holders.has(sid)) holders.set(sid, []);
            holders.get(sid)!.push(e.id);
          }
        }
        for (const [sid, r] of req) {
          const list = holders.get(sid) ?? [];
          if (list.length > r) {
            over = true;
            overCodes.add(shiftCode(sid));
            list.forEach((id) => overEmpIds.add(id));
          }
          if (list.length < r) {
            under = true;
            underCodes.add(shiftCode(sid));
          }
        }
      }
      map.set(day, {
        status: over ? "over" : under ? "under" : "ok",
        overCodes: [...overCodes],
        underCodes: [...underCodes],
        overEmpIds,
      });
    }
    return map;
  }, [employees, patternByEmp, hasCoverage, cellMap, days, shiftTypes]);

  const download = async (fmt: "xlsx" | "pdf") => {
    try {
      const res = await api.get(`/reports/roster.${fmt}`, {
        params: {
          year,
          month,
          ...(departmentId !== "" ? { department_id: departmentId } : {}),
          ...(jobTitle !== "" ? { job_title: jobTitle } : {}),
          ...(siteId !== "" ? { site_id: siteId } : {}),
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
          <Button variant="danger" onClick={() => setShowClear(true)}>
            <Trash2 size={16} /> Clear month
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
          <select
            value={siteId}
            onChange={(e) =>
              setSiteId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            <option value="">All locations</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
                    // Cell is a duplicate if its shift is over its house's
                    // required count this day.
                    const isDuplicate =
                      cell?.shift_type_id != null &&
                      !!coverageByDay.get(d)?.overEmpIds.has(emp.id);
                    return (
                      <td
                        key={d}
                        onClick={() => setEditing({ emp, day: d })}
                        className={
                          "border-b border-l border-neutral-100 text-center cursor-pointer h-8 " +
                          (isDuplicate
                            ? "bg-danger-50 text-danger-700 font-bold ring-2 ring-inset ring-danger-500 "
                            : isAbsence
                            ? "bg-warning-50 text-warning-700 font-semibold"
                            : label
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "hover:bg-primary-50/50")
                        }
                        title={
                          isDuplicate
                            ? `Duplicate: ${shiftCode(
                                cell!.shift_type_id!
                              )} is over its required count this day`
                            : cell?.substitutes_for_id
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
            {hasCoverage && (
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-10 bg-white border-t-2 border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-600 whitespace-nowrap">
                    Day coverage
                  </td>
                  {days.map((d) => {
                    const cov = coverageByDay.get(d);
                    const st = cov?.status ?? null;
                    const bg =
                      st === "ok"
                        ? "bg-success-500"
                        : st === "under"
                        ? "bg-warning-500"
                        : st === "over"
                        ? "bg-danger-500"
                        : "bg-neutral-100";
                    const sym =
                      st === "ok"
                        ? "✓"
                        : st === "under"
                        ? "↓"
                        : st === "over"
                        ? "↑"
                        : "";
                    const title =
                      st === "ok"
                        ? "Coverage complete"
                        : st === "under"
                        ? `Incomplete — short: ${cov!.underCodes.join(", ")}`
                        : st === "over"
                        ? `Excessive — too many: ${cov!.overCodes.join(", ")}`
                        : "";
                    return (
                      <td
                        key={d}
                        title={title}
                        className={
                          "border-t-2 border-l border-neutral-200 text-center h-6 text-[11px] font-bold text-white " +
                          bg
                        }
                      >
                        {sym}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
          {hasCoverage && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-success-500" /> OK
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-warning-500" />{" "}
                Incomplete (below required)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-danger-500" />{" "}
                Excessive (above required)
              </span>
            </div>
          )}
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
          sameDayShiftHolders={(shiftId: number) =>
            employees
              .filter(
                (e) =>
                  e.id !== editing.emp.id &&
                  e.site_id === editing.emp.site_id &&
                  cellMap.get(`${e.id}-${editing.day}`)?.shift_type_id === shiftId
              )
              .map((e) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` }))
          }
          onClose={() => setEditing(null)}
          onReload={loadRoster}
          onDone={() => {
            setEditing(null);
            loadRoster();
          }}
        />
      )}

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}

      {showClear && (
        <ClearMonthModal
          monthLabel={months[month - 1]}
          year={year}
          scope={
            siteId !== ""
              ? sites.find((s) => s.id === siteId)?.name ?? null
              : jobTitle !== ""
              ? jobTitles.find((j) => j.name === jobTitle)?.label ?? jobTitle
              : departmentId !== ""
              ? departments.find((d) => d.id === departmentId)?.name ?? null
              : null
          }
          onClose={() => setShowClear(false)}
          onDone={() => {
            setShowClear(false);
            loadRoster();
          }}
          params={{
            year,
            month,
            ...(departmentId !== "" ? { department_id: departmentId } : {}),
            ...(jobTitle !== "" ? { job_title: jobTitle } : {}),
            ...(siteId !== "" ? { site_id: siteId } : {}),
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
  rotations,
  existing,
  sameDayShiftHolders,
  onClose,
  onReload,
  onDone,
}: {
  employee: Employee;
  dateStr: string;
  shiftTypes: ShiftTypeDef[];
  rotations: RotationPattern[];
  existing: RosterCell | null;
  sameDayShiftHolders: (shiftId: number) => { id: number; name: string }[];
  onClose: () => void;
  onReload: () => void;
  onDone: () => void;
}) {
  const [subs, setSubs] = useState<SubstituteCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [savedKind, setSavedKind] = useState<"shift" | "absence" | null>(null);
  const [overWarn, setOverWarn] = useState<{
    shiftId: number;
    code: string;
    have: number;
    req: number;
    holder: { id: number; name: string };
  } | null>(null);

  // The shift this cell held before the edit — the gap to cover when a leave
  // replaces a working shift.
  const gapShiftId = existing?.shift_type_id ?? null;

  // The rotation pattern for this employee's category + house (for
  // propagation). Prefer the house-specific one; fall back to category-wide.
  const pattern =
    rotations.find(
      (r) =>
        r.job_title === employee.job_title &&
        r.site_id === employee.site_id &&
        r.is_active
    ) ??
    rotations.find(
      (r) =>
        r.job_title === employee.job_title && r.site_id === null && r.is_active
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
      const isAbsence = !!payload.absence_code;
      setSavedKind(isAbsence ? "absence" : "shift");
      if (isAbsence) loadSubs(); // a leave needs cover — surface substitutes
      onReload(); // refresh grid behind; keep editor open for propagation
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Assign a working shift, but warn first if it already has its required
  // number of people this day in this house (esp. important on the day-1 seed).
  const assignShift = (shiftId: number) => {
    const req = pattern?.coverage.find(
      (c) => c.shift_type_id === shiftId
    )?.required_count;
    const holders = sameDayShiftHolders(shiftId);
    if (req != null && holders.length >= req) {
      const code = shiftTypes.find((s) => s.id === shiftId)?.code ?? "This shift";
      setOverWarn({
        shiftId,
        code,
        have: holders.length,
        req,
        holder: holders[0],
      });
      return; // over capacity — offer a swap instead of duplicating
    }
    save({ shift_type_id: shiftId });
  };

  // Give the shift to this employee AND move it off the current holder by
  // exchanging their two cells — keeps coverage balanced (never both).
  const doSwap = async () => {
    if (!overWarn) return;
    setSaving(true);
    try {
      await api.post("/roster/swap", {
        employee_a_id: overWarn.holder.id,
        employee_b_id: employee.id,
        work_date: dateStr,
      });
      toast.success(`Swapped with ${overWarn.holder.name}.`);
      setOverWarn(null);
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Swap failed");
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
      toast.success(`Rotation regenerated — ${r.filled_cells} cells.`);
      for (const a of r.alerts ?? []) {
        toast(a, { icon: "⚠️", duration: 7000 });
      }
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
          ...(gapShiftId != null ? { shift_type_id: gapShiftId } : {}),
          ...(employee.site_id != null ? { site_id: employee.site_id } : {}),
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
              onClick={() => assignShift(s.id)}
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

        {overWarn && (
          <div className="mt-3 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm">
            <p className="font-medium text-warning-800">
              ⚠️ {overWarn.code} is already held by {overWarn.holder.name} on{" "}
              {dateStr} (coverage {overWarn.req}).
            </p>
            <p className="mt-1 text-xs text-warning-700">
              Swapping gives {overWarn.code} to {employee.first_name}{" "}
              {employee.last_name}, and {overWarn.holder.name} takes{" "}
              {employee.first_name}&apos;s current shift — so it&apos;s never
              assigned to both.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" onClick={doSwap} loading={saving}>
                Swap with {overWarn.holder.name}
              </Button>
              <Button variant="ghost" onClick={() => setOverWarn(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

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
                    {s.on_rest && (
                      <span className="ml-2 rounded bg-success-50 px-1.5 py-0.5 text-[10px] text-success-700">
                        rest day
                      </span>
                    )}
                    {s.is_cross_role && (
                      <span className="ml-2 text-[10px] text-info-500">
                        cross-role
                      </span>
                    )}
                    {s.is_cross_site && (
                      <span className="ml-2 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] text-warning-700">
                        other house
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

        {savedOnce && savedKind === "absence" && (
          <div className="mt-5 rounded-lg border border-warning-300 bg-warning-50/50 p-3">
            <p className="text-sm font-medium text-neutral-800">
              {employee.first_name} is on leave
              {gapShiftId
                ? ` — their ${
                    shiftTypes.find((s) => s.id === gapShiftId)?.code ?? ""
                  } shift needs cover.`
                : "."}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Available substitutes (same house first) are listed above. Pick one
              and assign them on their own row — the software never assigns cover
              on its own.
            </p>
            <div className="mt-2">
              <Button variant="secondary" onClick={loadSubs}>
                Find cover for this leave
              </Button>
            </div>
          </div>
        )}

        {savedOnce && savedKind === "shift" && pattern && (
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
                Regenerate the whole month&apos;s rotation (keeps edits)
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
              Fills the whole month by rotating each employee through the
              category&apos;s shift order (e.g. M → P/N → S → R), keeping daily
              coverage balanced. Absences you&apos;ve entered are kept and every
              cell stays editable. You&apos;ll be alerted if the staff count
              doesn&apos;t match the coverage total.
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
                      {p.site_name && ` · ${p.site_name}`}
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
            {result.alerts.length > 0 && (
              <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                <div className="flex items-center gap-2 font-semibold">
                  ⚠️ Please check — the schedule may not balance:
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {result.alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
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

function ClearMonthModal({
  monthLabel,
  year,
  scope,
  params,
  onClose,
  onDone,
}: {
  monthLabel: string;
  year: number;
  scope: string | null;
  params: Record<string, unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [keepAbsences, setKeepAbsences] = useState(true);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    try {
      const res = await api.delete("/roster/month", {
        params: { ...params, keep_absences: keepAbsences },
      });
      toast.success(`Cleared ${res.data.cleared} cells.`);
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Clear failed");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">
            Clear {monthLabel} {year}?
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          This removes the schedule for{" "}
          <b>{scope ? scope : "all staff"}</b> in {monthLabel} {year}. This can&apos;t
          be undone (but you can re-generate with Auto-fill).
        </p>
        <label className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={keepAbsences}
            onChange={(e) => setKeepAbsences(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-neutral-800">
              Keep absences
            </span>
            <span className="block text-xs text-neutral-500">
              Preserve entered vacation / sick leave / transfers. Uncheck to wipe
              everything.
            </span>
          </span>
        </label>
        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={clear} loading={busy}>
            Clear month
          </Button>
        </div>
      </Card>
    </div>
  );
}

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
