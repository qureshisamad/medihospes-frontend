"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { holidayName } from "@/lib/holidays";
import { useI18n } from "@/lib/i18n";
import { monthNames, weekdayInitials } from "@/lib/dates";
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

// How a cell renders in a given "viewing" house, accounting for cross-house
// loans (objective 3, part 2). A cell's effective house is its per-cell
// site_id override, else the employee's home house.
//   - "b2out": a home operator working elsewhere that day → shown as B2.
//   - "onloan": an operator from another house working in this one.
//   - "normal": ordinary shift/absence in this house (or no house filter).
type CellKind = "empty" | "normal" | "onloan" | "b2out" | "pending";
function deriveCell(
  cell: RosterCell | undefined,
  empHome: number | null,
  viewHouse: number | null,
  shiftCode: (id: number | null) => string
): { label: string; kind: CellKind; isAbsence: boolean } {
  if (!cell) return { label: "", kind: "empty", isAbsence: false };
  if (cell.is_pending) {
    // Pending belongs to the person's home house (no site override).
    if (viewHouse == null || empHome === viewHouse) {
      return { label: "Pend", kind: "pending", isAbsence: false };
    }
    return { label: "", kind: "empty", isAbsence: false };
  }
  if (
    viewHouse != null &&
    empHome === viewHouse &&
    cell.site_id != null &&
    cell.site_id !== viewHouse
  ) {
    return { label: "B2", kind: "b2out", isAbsence: true };
  }
  const eff = cell.site_id ?? empHome;
  if (viewHouse == null || eff === viewHouse) {
    if (cell.shift_type_id != null) {
      const onloan = viewHouse != null && empHome !== viewHouse;
      return {
        label: shiftCode(cell.shift_type_id),
        kind: onloan ? "onloan" : "normal",
        isAbsence: false,
      };
    }
    if (cell.absence_code) {
      return { label: cell.absence_code, kind: "normal", isAbsence: true };
    }
  }
  return { label: "", kind: "empty", isAbsence: false };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function RosterPage() {
  const { t, locale } = useI18n();
  const WEEKDAY = weekdayInitials(locale);
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

  // "Detached" second house shown below the main grid for coordination
  // (objective 3, part 1). Read-only reference of another casa's cells.
  // "Compare with…" — one or more houses shown detached below the main grid.
  const [compareSiteIds, setCompareSiteIds] = useState<number[]>([]);
  const [compareData, setCompareData] = useState<
    Map<number, { employees: Employee[]; cells: RosterCell[] }>
  >(new Map());
  const [compareOpen, setCompareOpen] = useState(false);
  // Operator being brought over from a detached house (objective 3, part 2).
  const [bringing, setBringing] = useState<Employee | null>(null);

  // Weekly vs monthly view. Weekly shows one Mon–Sun week at a time with
  // prev/next controls; monthly shows the whole month (the original grid).
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [weekIndex, setWeekIndex] = useState(0);

  const days = useMemo(() => {
    const n = daysInMonth(year, month);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [year, month]);

  // The month split into Mon–Sun weeks (partial weeks at the ends are kept).
  const weeks = useMemo(() => {
    const out: number[][] = [];
    let cur: number[] = [];
    for (const d of days) {
      // JS getDay(): 1 = Monday. Start a new week on Mondays (after day 1).
      if (new Date(year, month - 1, d).getDay() === 1 && cur.length) {
        out.push(cur);
        cur = [];
      }
      cur.push(d);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [days, year, month]);

  // Default the week to the one containing today (when on the current month),
  // and keep weekIndex in range whenever the month/weeks change.
  useEffect(() => {
    const today = new Date();
    let idx = 0;
    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      const di = weeks.findIndex((w) => w.includes(today.getDate()));
      if (di >= 0) idx = di;
    }
    setWeekIndex(idx);
  }, [year, month, weeks]);

  const visibleDays =
    viewMode === "week" ? weeks[weekIndex] ?? days : days;

  // Weekday + festività metadata per day. Sundays and Italian public holidays
  // (incl. the Messina patron feast) are flagged red in the header.
  const dayMeta = useMemo(() => {
    const m = new Map<
      number,
      { dow: number; holiday: string | null; isRed: boolean }
    >();
    for (const d of days) {
      const dow = new Date(year, month - 1, d).getDay();
      const holiday = holidayName(year, month, d);
      m.set(d, { dow, holiday, isRed: dow === 0 || holiday != null });
    }
    return m;
  }, [days, year, month]);

  // The named festività falling in this month, for the reference list below the
  // grid (so the manager doesn't have to hover each red header to read them).
  const monthHolidays = useMemo(
    () =>
      days
        .map((d) => ({ day: d, name: dayMeta.get(d)?.holiday ?? null }))
        .filter((x): x is { day: number; name: string } => x.name != null),
    [days, dayMeta]
  );

  // Guard against out-of-order responses: the backend talks to a remote DB, so
  // a slower earlier request can resolve after a newer one. Only the latest
  // in-flight load is allowed to write state.
  const loadSeq = useRef(0);

  const loadRoster = useCallback(() => {
    setLoading(true);
    const seq = ++loadSeq.current;
    const scope = {
      ...(departmentId !== "" ? { department_id: departmentId } : {}),
      ...(jobTitle !== "" ? { job_title: jobTitle } : {}),
      ...(siteId !== "" ? { site_id: siteId } : {}),
    };
    Promise.all([
      api.get("/employees", {
        params: { is_active: true, year, month, ...scope },
      }),
      api.get("/roster", { params: { year, month, ...scope } }),
    ])
      .then(([e, r]) => {
        if (seq !== loadSeq.current) return; // a newer load superseded this one
        setEmployees(e.data);
        setCells(r.data);
      })
      .catch(() => {
        if (seq === loadSeq.current) toast.error(t("ros.loadFailed"));
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
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

  // Load every selected detached house (same category/dept scope, per site).
  const compareSeq = useRef(0);
  const loadCompare = useCallback(() => {
    const seq = ++compareSeq.current;
    if (compareSiteIds.length === 0) {
      setCompareData(new Map());
      return;
    }
    const base = {
      ...(departmentId !== "" ? { department_id: departmentId } : {}),
      ...(jobTitle !== "" ? { job_title: jobTitle } : {}),
    };
    Promise.all(
      compareSiteIds.map(async (sid) => {
        const [e, r] = await Promise.all([
          api.get("/employees", {
            params: { is_active: true, year, month, ...base, site_id: sid },
          }),
          api.get("/roster", { params: { year, month, ...base, site_id: sid } }),
        ]);
        return [sid, { employees: e.data, cells: r.data }] as const;
      })
    )
      .then((entries) => {
        if (seq !== compareSeq.current) return; // superseded
        setCompareData(new Map(entries));
      })
      .catch(() => {
        if (seq === compareSeq.current)
          toast.error(t("ros.loadCompareFailed"));
      });
  }, [compareSiteIds, year, month, departmentId, jobTitle]);

  useEffect(() => {
    loadCompare();
  }, [loadCompare]);

  // Compare houses only make sense against a chosen primary house; clear them
  // when no primary site is selected, and never let one duplicate the primary.
  useEffect(() => {
    if (siteId === "") {
      setCompareSiteIds([]);
      setCompareOpen(false);
    } else {
      setCompareSiteIds((prev) => prev.filter((id) => id !== siteId));
    }
  }, [siteId]);

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

  // The house being viewed in the main grid (null when "All locations"), and
  // lookups used for cross-house loan rendering (part 2).
  const primarySite = siteId === "" ? null : siteId;
  const siteName = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);
  const empHome = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const e of employees) m.set(e.id, e.site_id);
    return m;
  }, [employees]);

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
    // Distinct house patterns to evaluate. Only the houses actually shown as
    // PRIMARY here count — an on-loan employee must NOT drag in their HOME
    // house's pattern, which would have no holders in this view and mark every
    // day incomplete. Their cells still COUNT toward the receiving house via
    // the effective-site check below.
    const patterns = [
      ...new Map(
        employees
          .filter((e) => primarySite == null || e.site_id === primarySite)
          .map((e) => patternByEmp.get(e.id))
          .filter((p): p is RotationPattern => !!p)
          .map((p) => [p.id, p])
      ).values(),
    ];
    for (const day of days) {
      let over = false;
      let under = false;
      const overCodes = new Set<string>();
      const underCodes = new Set<string>();
      const overEmpIds = new Set<number>();
      for (const pattern of patterns) {
        const req = new Map(
          pattern.coverage.map((c) => [c.shift_type_id, c.required_count])
        );
        const holders = new Map<number, number[]>(); // shift -> empIds
        for (const e of employees) {
          const cell = cellMap.get(`${e.id}-${day}`);
          const sid = cell?.shift_type_id;
          if (sid == null || !req.has(sid)) continue;
          // Count a cell toward this house only if it EFFECTIVELY belongs here
          // (its site override, else the employee's home) — so an on-loan cell
          // counts for the receiving house and a transferred-out one does not.
          // Category-wide patterns (no site) fall back to the home pattern map.
          const belongs =
            pattern.site_id == null
              ? patternByEmp.get(e.id)?.id === pattern.id
              : (cell!.site_id ?? empHome.get(e.id) ?? null) === pattern.site_id;
          if (!belongs) continue;
          if (!holders.has(sid)) holders.set(sid, []);
          holders.get(sid)!.push(e.id);
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
  }, [
    employees,
    patternByEmp,
    hasCoverage,
    cellMap,
    days,
    shiftTypes,
    empHome,
    primarySite,
  ]);

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
      toast.error(t("ros.exportFailed"));
    }
  };

  const months = monthNames(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("ros.title")}</h1>
          <p className="mt-1 text-neutral-500">{t("ros.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAutoFill(true)}>
            <Repeat size={16} /> {t("ros.autofill")}
          </Button>
          <Button variant="secondary" onClick={() => setShowHistory(true)}>
            <History size={16} /> {t("ros.history")}
          </Button>
          <Button variant="danger" onClick={() => setShowClear(true)}>
            <Trash2 size={16} /> {t("ros.clearMonth")}
          </Button>
          <Button variant="secondary" onClick={() => download("xlsx")}>
            <Download size={16} /> {t("ros.excel")}
          </Button>
          <Button variant="secondary" onClick={() => download("pdf")}>
            <Download size={16} /> {t("ros.pdf")}
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
            <option value="">{t("ros.allDepartments")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
          >
            <option value="">{t("ros.allCategories")}</option>
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
            <option value="">{t("ros.allLocations")}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {siteId !== "" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setCompareOpen((o) => !o)}
                title={t("ros.compareHint")}
                className="flex h-10 items-center gap-1 rounded-lg border border-dashed border-neutral-400 px-3 text-sm"
              >
                {compareSiteIds.length === 0
                  ? t("ros.compareWith")
                  : compareSiteIds.length === 1
                  ? t("ros.comparingOne")
                  : t("ros.comparingMany", { n: compareSiteIds.length })}
                <ChevronDown size={14} />
              </button>
              {compareOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setCompareOpen(false)}
                  />
                  <div className="absolute left-0 top-11 z-30 max-h-72 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg">
                    {sites
                      .filter((s) => s.id !== siteId)
                      .map((s) => {
                        const on = compareSiteIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={
                              "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm " +
                              (on ? "bg-primary-50" : "hover:bg-neutral-50")
                            }
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setCompareSiteIds((prev) =>
                                  prev.includes(s.id)
                                    ? prev.filter((x) => x !== s.id)
                                    : [...prev, s.id]
                                )
                              }
                            />
                            {s.name}
                          </label>
                        );
                      })}
                    {compareSiteIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCompareSiteIds([])}
                        className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-50"
                      >
                        {t("ros.clearAll")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          {/* Weekly / Monthly view toggle */}
          <div className="inline-flex rounded-lg border border-neutral-300 p-0.5">
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium " +
                  (viewMode === m
                    ? "bg-primary-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100")
                }
              >
                {m === "week" ? t("ros.weekly") : t("ros.monthly")}
              </button>
            ))}
          </div>

          {/* Week navigation (weekly view only) */}
          {viewMode === "week" && weeks.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                disabled={weekIndex === 0}
              >
                <ChevronLeft size={16} /> {t("ros.prev")}
              </Button>
              <span className="min-w-[150px] text-center text-sm font-medium text-neutral-700">
                {t("ros.weekOf", { n: weekIndex + 1, total: weeks.length })}
                {visibleDays.length > 0 && (
                  <span className="block text-[11px] font-normal text-neutral-400">
                    {months[month - 1].slice(0, 3)} {visibleDays[0]}–
                    {visibleDays[visibleDays.length - 1]}
                  </span>
                )}
              </span>
              <Button
                variant="secondary"
                onClick={() =>
                  setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))
                }
                disabled={weekIndex >= weeks.length - 1}
              >
                {t("ros.next")} <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100 animate-pulse" />
      ) : employees.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">
            {t("ros.noEmployees")}
          </p>
        </Card>
      ) : (
        <Card padding="sm" className="overflow-x-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white border-b border-neutral-200 px-2 py-2 text-left font-semibold min-w-[160px]">
                  {t("ros.employee")}
                </th>
                {visibleDays.map((d) => {
                  const meta = dayMeta.get(d)!;
                  const tip =
                    meta.holiday ?? (meta.dow === 0 ? t("tip.sunday") : undefined);
                  return (
                    <th
                      key={d}
                      title={tip}
                      className={
                        "border-b border-neutral-200 px-1 py-1 text-center font-medium w-8 " +
                        (meta.holiday
                          ? "bg-danger-700 text-white" // festività — dark red
                          : meta.dow === 0
                          ? "bg-danger-50 text-danger-700" // Sunday — light red
                          : "text-black")
                      }
                    >
                      <span
                        className={
                          "block text-[9px] font-normal uppercase leading-tight " +
                          (meta.holiday
                            ? "opacity-90"
                            : meta.dow === 0
                            ? ""
                            : "text-black")
                        }
                      >
                        {WEEKDAY[meta.dow]}
                      </span>
                      <span className="block leading-tight">{d}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-neutral-50">
                  <td className="sticky left-0 z-10 bg-white border-b border-neutral-100 px-2 py-1.5 whitespace-nowrap">
                    <span className="font-medium text-neutral-900">
                      {emp.last_name} {emp.first_name}
                    </span>
                    {primarySite != null && emp.site_id !== primarySite && (
                      <span
                        className="ml-1 rounded bg-info-50 px-1 py-0.5 text-[9px] font-semibold text-info-500"
                        title={t("tip.onLoanFrom", {
                          house: siteName.get(emp.site_id ?? -1) ?? "—",
                        })}
                      >
                        ⇄ {siteName.get(emp.site_id ?? -1) ?? "loan"}
                      </span>
                    )}
                    <span className="block text-[10px] text-neutral-400 capitalize">
                      {emp.job_title}
                    </span>
                  </td>
                  {visibleDays.map((d) => {
                    const cell = cellMap.get(`${emp.id}-${d}`);
                    const derived = deriveCell(
                      cell,
                      emp.site_id ?? null,
                      primarySite,
                      shiftCode
                    );
                    const label = derived.label;
                    const isAbsence = derived.isAbsence;
                    const isOnLoan = derived.kind === "onloan";
                    const isB2Out = derived.kind === "b2out";
                    const isPending = derived.kind === "pending";
                    // Cell is a duplicate if its shift is over this house's
                    // required count this day (never a transferred-out cell).
                    const isDuplicate =
                      cell?.shift_type_id != null &&
                      !isB2Out &&
                      !!coverageByDay.get(d)?.overEmpIds.has(emp.id);
                    const hasNote = !!cell?.notes;
                    const title =
                      [
                        isDuplicate
                          ? t("tip.duplicate", {
                              code: shiftCode(cell!.shift_type_id!),
                            })
                          : null,
                        isOnLoan
                          ? t("tip.onLoanFrom", {
                              house: siteName.get(emp.site_id ?? -1) ?? "—",
                            })
                          : null,
                        isB2Out
                          ? t("tip.transferredTo", {
                              house: siteName.get(cell!.site_id!) ?? "—",
                            })
                          : null,
                        isPending ? t("tip.pending") : null,
                        cell?.substitutes_for_id ? t("tip.substitution") : null,
                        hasNote ? t("tip.note", { note: cell!.notes! }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || undefined;
                    return (
                      <td
                        key={d}
                        onClick={() => setEditing({ emp, day: d })}
                        className={
                          "relative border-b border-l border-neutral-100 text-center cursor-pointer h-8 " +
                          (isDuplicate
                            ? "bg-danger-50 text-danger-700 font-bold ring-2 ring-inset ring-danger-500 "
                            : isB2Out
                            ? "bg-warning-50 text-warning-600 font-medium italic"
                            : isOnLoan
                            ? "bg-info-50 text-info-500 font-semibold ring-1 ring-inset ring-info-500/40"
                            : isPending
                            ? "bg-neutral-100 text-neutral-400 font-medium italic"
                            : isAbsence
                            ? "bg-warning-50 text-warning-700 font-semibold"
                            : label
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "hover:bg-primary-50/50")
                        }
                        title={title}
                      >
                        {label}
                        {cell?.substitutes_for_id ? "*" : ""}
                        {hasNote && (
                          <span
                            className="pointer-events-none absolute right-0.5 top-0 text-[20px] font-bold leading-none text-danger-500"
                            aria-label="Has comment"
                          >
                            *
                          </span>
                        )}
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
                    {t("ros.dayCoverage")}
                  </td>
                  {visibleDays.map((d) => {
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
                        ? t("cov.complete")
                        : st === "under"
                        ? t("cov.shortList", {
                            codes: cov!.underCodes.join(", "),
                          })
                        : st === "over"
                        ? t("cov.overList", { codes: cov!.overCodes.join(", ") })
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
          {monthHolidays.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1 font-medium text-danger-700">
                <span className="inline-block h-3 w-3 rounded bg-danger-700" />
                {t("ros.festivita", { month: months[month - 1] })}
              </span>
              {monthHolidays.map((h) => (
                <span key={h.day} className="whitespace-nowrap">
                  <span className="font-semibold text-danger-700">{h.day}</span>{" "}
                  {h.name}
                </span>
              ))}
            </div>
          )}
          {hasCoverage && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-success-500" />{" "}
                {t("cov.ok")}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-warning-500" />{" "}
                {t("cov.under")}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-danger-500" />{" "}
                {t("cov.over")}
              </span>
            </div>
          )}
        </Card>
      )}

      {primarySite != null &&
        compareSiteIds.map((sid) => {
          const data = compareData.get(sid);
          return (
            <CompareGrid
              key={sid}
              houseName={siteName.get(sid) ?? "Other house"}
              viewHouse={sid}
              primaryHouseName={siteName.get(primarySite) ?? "this house"}
              employees={data?.employees ?? []}
              cells={data?.cells ?? []}
              visibleDays={visibleDays}
              dayMeta={dayMeta}
              shiftTypes={shiftTypes}
              siteName={siteName}
              onBring={(emp) => setBringing(emp)}
              onClose={() =>
                setCompareSiteIds((prev) => prev.filter((x) => x !== sid))
              }
            />
          );
        })}

      {bringing && primarySite != null && (
        <BringDialog
          operator={bringing}
          targetSite={primarySite}
          targetSiteName={siteName.get(primarySite) ?? "this house"}
          homeSiteName={siteName.get(bringing.site_id ?? -1) ?? "their house"}
          visibleDays={visibleDays}
          dayMeta={dayMeta}
          dateStr={dateStr}
          shiftTypes={shiftTypes}
          rotations={rotations}
          primaryEmployees={employees}
          primaryCellMap={cellMap}
          empHome={empHome}
          onClose={() => setBringing(null)}
          onDone={() => {
            setBringing(null);
            loadRoster();
            loadCompare();
          }}
        />
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
          primarySite={primarySite}
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
          dayPendingPerson={(() => {
            // Someone else in the same house benched (pending) that day — the
            // swap target when marking this person pending.
            const p = employees.find(
              (e) =>
                e.id !== editing.emp.id &&
                e.site_id === editing.emp.site_id &&
                cellMap.get(`${e.id}-${editing.day}`)?.is_pending
            );
            return p ? { id: p.id, name: `${p.first_name} ${p.last_name}` } : null;
          })()}
          onClose={() => setEditing(null)}
          onReload={() => {
            loadRoster();
            loadCompare(); // a cross-house cell change affects the detached grid
          }}
          onDone={() => {
            setEditing(null);
            loadRoster();
            loadCompare();
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

// Read-only "detached" grid of a second house, shown below the main roster so
// the manager can see another casa's filled/empty cells while scheduling
// (objective 3, part 1). Day columns mirror the main grid (same week + festività
// colouring) so the two houses line up day-for-day.
function CompareGrid({
  houseName,
  viewHouse,
  primaryHouseName,
  employees,
  cells,
  visibleDays,
  dayMeta,
  shiftTypes,
  siteName,
  onBring,
  onClose,
}: {
  houseName: string;
  viewHouse: number;
  primaryHouseName: string;
  employees: Employee[];
  cells: RosterCell[];
  visibleDays: number[];
  dayMeta: Map<
    number,
    { dow: number; holiday: string | null; isRed: boolean }
  >;
  shiftTypes: ShiftTypeDef[];
  siteName: Map<number, string>;
  onBring: (emp: Employee) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const WEEKDAY = weekdayInitials(locale);
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

  return (
    <Card padding="sm" className="overflow-x-auto border-dashed">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {t("ros.detached")}
        </span>
        <span className="text-sm font-medium text-neutral-800">{houseName}</span>
        <span className="text-[11px] text-neutral-400">
          · {t("ros.clickToBring", { house: primaryHouseName })}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-neutral-400 hover:text-neutral-700"
          aria-label={t("common.close")}
        >
          <X size={16} />
        </button>
      </div>
      {employees.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">
          {t("ros.noneInHouse", { house: houseName })}
        </p>
      ) : (
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border-b border-neutral-200 px-2 py-2 text-left font-semibold min-w-[160px]">
                {t("ros.employee")}
              </th>
              {visibleDays.map((d) => {
                const meta = dayMeta.get(d)!;
                const tip =
                  meta.holiday ?? (meta.dow === 0 ? t("tip.sunday") : undefined);
                return (
                  <th
                    key={d}
                    title={tip}
                    className={
                      "border-b border-neutral-200 px-1 py-1 text-center font-medium w-8 " +
                      (meta.holiday
                        ? "bg-danger-700 text-white"
                        : meta.dow === 0
                        ? "bg-danger-50 text-danger-700"
                        : "text-black")
                    }
                  >
                    <span
                      className={
                        "block text-[9px] font-normal uppercase leading-tight " +
                        (meta.holiday
                          ? "opacity-90"
                          : meta.dow === 0
                          ? ""
                          : "text-black")
                      }
                    >
                      {WEEKDAY[meta.dow]}
                    </span>
                    <span className="block leading-tight">{d}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const onLoanElsewhere = emp.site_id !== viewHouse; // shown here via a cell override
              return (
              <tr key={emp.id} className="hover:bg-neutral-50">
                <td className="sticky left-0 z-10 bg-white border-b border-neutral-100 px-2 py-1.5 whitespace-nowrap">
                  <button
                    onClick={() => onBring(emp)}
                    className="text-left font-medium text-neutral-900 hover:text-primary-600 hover:underline"
                    title={t("ros.bringTitle", {
                      name: `${emp.first_name} ${emp.last_name}`,
                      house: primaryHouseName,
                    })}
                  >
                    {emp.last_name} {emp.first_name}
                  </button>
                  {onLoanElsewhere && (
                    <span className="ml-1 rounded bg-info-50 px-1 py-0.5 text-[9px] font-semibold text-info-500">
                      ⇄ {siteName.get(emp.site_id ?? -1) ?? "loan"}
                    </span>
                  )}
                  <span className="block text-[10px] text-neutral-400 capitalize">
                    {emp.job_title}
                  </span>
                </td>
                {visibleDays.map((d) => {
                  const cell = cellMap.get(`${emp.id}-${d}`);
                  const derived = deriveCell(
                    cell,
                    emp.site_id ?? null,
                    viewHouse,
                    shiftCode
                  );
                  const hasNote = !!cell?.notes;
                  const isB2Out = derived.kind === "b2out";
                  const isPending = derived.kind === "pending";
                  return (
                    <td
                      key={d}
                      title={
                        isB2Out
                          ? t("tip.transferredTo", {
                              house: siteName.get(cell!.site_id!) ?? "—",
                            })
                          : isPending
                          ? t("tip.pending")
                          : hasNote
                          ? t("tip.note", { note: cell!.notes! })
                          : undefined
                      }
                      className={
                        "relative border-b border-l border-neutral-100 text-center h-8 " +
                        (isB2Out
                          ? "bg-warning-50 text-warning-600 font-medium italic"
                          : isPending
                          ? "bg-neutral-100 text-neutral-400 font-medium italic"
                          : derived.isAbsence
                          ? "bg-warning-50 text-warning-700 font-semibold"
                          : derived.label
                          ? "bg-primary-50 text-primary-700 font-semibold"
                          : "")
                      }
                    >
                      {derived.label}
                      {hasNote && (
                        <span
                          className="pointer-events-none absolute right-0.5 top-0 text-[20px] font-bold leading-none text-danger-500"
                          aria-label="Has comment"
                        >
                          *
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// "Bring an operator from another house for specified days" (objective 3,
// part 2). Writes one cell per picked day with a site_id override to the target
// house; the home house then derives B2 for those days. Shift picks are
// coverage-aware — the day pre-selects the shift the target house is short on.
function BringDialog({
  operator,
  targetSite,
  targetSiteName,
  homeSiteName,
  visibleDays,
  dayMeta,
  dateStr,
  shiftTypes,
  rotations,
  primaryEmployees,
  primaryCellMap,
  empHome,
  onClose,
  onDone,
}: {
  operator: Employee;
  targetSite: number;
  targetSiteName: string;
  homeSiteName: string;
  visibleDays: number[];
  dayMeta: Map<
    number,
    { dow: number; holiday: string | null; isRed: boolean }
  >;
  dateStr: (day: number) => string;
  shiftTypes: ShiftTypeDef[];
  rotations: RotationPattern[];
  primaryEmployees: Employee[];
  primaryCellMap: Map<string, RosterCell>;
  empHome: Map<number, number | null>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const WEEKDAY = weekdayInitials(locale);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const shiftCode = (id: number | null) =>
    shiftTypes.find((s) => s.id === id)?.code ?? "?";

  // Target house's rotation for this category (coverage → gap suggestions).
  const pattern =
    rotations.find(
      (r) =>
        r.is_active &&
        r.coverage.length > 0 &&
        r.job_title === operator.job_title &&
        r.site_id === targetSite
    ) ??
    rotations.find(
      (r) =>
        r.is_active &&
        r.coverage.length > 0 &&
        r.job_title === operator.job_title &&
        r.site_id === null
    ) ??
    null;

  const req = useMemo(
    () =>
      new Map(
        (pattern?.coverage ?? []).map((c) => [c.shift_type_id, c.required_count])
      ),
    [pattern]
  );

  // Current holders per shift IN THE TARGET HOUSE on a day (by effective site).
  const holdersOn = (day: number) => {
    const m = new Map<number, number>();
    for (const e of primaryEmployees) {
      const c = primaryCellMap.get(`${e.id}-${day}`);
      const sid = c?.shift_type_id;
      if (sid == null) continue;
      const eff = c!.site_id ?? empHome.get(e.id) ?? e.site_id ?? null;
      if (eff !== targetSite) continue;
      m.set(sid, (m.get(sid) ?? 0) + 1);
    }
    return m;
  };

  // The shift the target house is short on that day, if any.
  const shortShiftOn = (day: number): number | null => {
    if (req.size === 0) return null;
    const h = holdersOn(day);
    for (const [sid, r] of req) if ((h.get(sid) ?? 0) < r) return sid;
    return null;
  };

  const defaultShift = (day: number): number =>
    shortShiftOn(day) ??
    pattern?.coverage[0]?.shift_type_id ??
    shiftTypes[0]?.id ??
    0;

  const toggleDay = (day: number) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (day in next) delete next[day];
      else next[day] = defaultShift(day);
      return next;
    });

  const setDayShift = (day: number, shiftId: number) =>
    setPicked((prev) => ({ ...prev, [day]: shiftId }));

  const pickedDays = Object.keys(picked)
    .map(Number)
    .sort((a, b) => a - b);

  const confirm = async () => {
    if (pickedDays.length === 0) return;
    setSaving(true);
    try {
      for (const day of pickedDays) {
        await api.put("/roster/cell", {
          employee_id: operator.id,
          work_date: dateStr(day),
          shift_type_id: picked[day],
          site_id: targetSite,
        });
      }
      toast.success(
        t("bring.done", {
          name: `${operator.first_name} ${operator.last_name}`,
          target: targetSiteName,
          n: pickedDays.length,
        })
      );
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("bring.failed"));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {t("bring.title", {
                last: operator.last_name,
                first: operator.first_name,
              })}
            </h3>
            <p className="text-sm text-neutral-500">
              {t("bring.subtitle", {
                home: homeSiteName,
                target: targetSiteName,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          {t("bring.daysShift")}
        </p>
        <div className="space-y-1">
          {visibleDays.map((d) => {
            const meta = dayMeta.get(d)!;
            const checked = d in picked;
            const short = shortShiftOn(d);
            const chosen = picked[d];
            const isFull = req.size > 0 && short == null;
            const chosenOverCap =
              checked &&
              req.has(chosen) &&
              (holdersOn(d).get(chosen) ?? 0) >= (req.get(chosen) ?? 0);
            return (
              <div
                key={d}
                className={
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 " +
                  (checked ? "bg-primary-50/50" : "")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDay(d)}
                  id={`bring-day-${d}`}
                />
                <label
                  htmlFor={`bring-day-${d}`}
                  className={
                    "w-14 text-sm " +
                    (meta.isRed
                      ? "text-danger-700 font-medium"
                      : "text-neutral-700")
                  }
                >
                  {WEEKDAY[meta.dow]} {d}
                </label>
                {checked ? (
                  <>
                    <select
                      value={chosen}
                      onChange={(e) => setDayShift(d, Number(e.target.value))}
                      className="h-8 rounded-lg border border-neutral-300 px-2 text-sm"
                    >
                      {shiftTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                        </option>
                      ))}
                    </select>
                    {chosenOverCap ? (
                      <span className="text-[11px] font-medium text-warning-700">
                        {t("bring.alreadyFull")}
                      </span>
                    ) : req.has(chosen) ? (
                      <span className="text-[11px] text-success-700">
                        {t("bring.fillsGap")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[11px] text-neutral-400">
                    {req.size === 0
                      ? ""
                      : isFull
                      ? t("bring.fullyStaffed")
                      : t("bring.short", { code: shiftCode(short) })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
          {t("bring.footer", {
            name: operator.first_name,
            target: targetSiteName,
            home: homeSiteName,
          })}
        </div>

        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={confirm}
            loading={saving}
            disabled={pickedDays.length === 0 || saving}
          >
            {t("bring.confirm", { n: pickedDays.length })}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function CellEditor({
  employee,
  dateStr,
  shiftTypes,
  rotations,
  primarySite,
  existing,
  sameDayShiftHolders,
  dayPendingPerson,
  onClose,
  onReload,
  onDone,
}: {
  employee: Employee;
  dateStr: string;
  shiftTypes: ShiftTypeDef[];
  rotations: RotationPattern[];
  primarySite: number | null;
  existing: RosterCell | null;
  sameDayShiftHolders: (shiftId: number) => { id: number; name: string }[];
  dayPendingPerson: { id: number; name: string } | null;
  onClose: () => void;
  onReload: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  // House this cell should belong to: keep an existing override, otherwise if
  // we're editing an on-loan operator in a house that isn't theirs, keep them
  // in this (receiving) house rather than silently sending them home.
  const cellSite =
    existing?.site_id ??
    (primarySite != null && employee.site_id !== primarySite
      ? primarySite
      : null);
  const [subs, setSubs] = useState<SubstituteCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [savedKind, setSavedKind] = useState<"shift" | "absence" | null>(null);
  const [note, setNote] = useState(existing?.notes ?? "");
  const [overWarn, setOverWarn] = useState<{
    shiftId: number;
    code: string;
    have: number;
    req: number;
    holder: { id: number; name: string };
  } | null>(null);
  // Multi-day absence (e.g. Ferie/B across a span) — pick a code + days.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCode, setBulkCode] = useState<AbsenceCode>(ABSENCE_CODES[0]);
  const [bulkDays, setBulkDays] = useState<Set<number>>(
    () => new Set([Number(dateStr.slice(8, 10))])
  );

  // The shift this cell held when the editor opened — the gap to cover when a
  // leave replaces a working shift. Captured in state so it survives the cell
  // becoming an absence (the editor stays open and re-renders on save).
  const [gapShiftId] = useState<number | null>(existing?.shift_type_id ?? null);

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
        site_id: cellSite, // preserve/keep the cross-house loan override
        notes: note.trim() || null, // carry the cell's note through shift/absence edits
        ...payload,
      });
      toast.success(t("cell.saved"));
      setSavedOnce(true);
      const isAbsence = !!payload.absence_code;
      setSavedKind(isAbsence ? "absence" : "shift");
      if (isAbsence) loadSubs(); // a leave needs cover — surface substitutes
      onReload(); // refresh grid behind; keep editor open for propagation
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.saveFailed"));
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
      const code = shiftTypes.find((s) => s.id === shiftId)?.code ?? "?";
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
      toast.success(t("cell.swapped", { name: overWarn.holder.name }));
      setOverWarn(null);
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.swapFailed"));
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
      toast.success(t("cell.rotationRegen", { n: r.filled_cells }));
      for (const a of r.alerts ?? []) {
        toast(a, { icon: "⚠️", duration: 7000 });
      }
      if (r.unmet?.length) {
        toast(t("cell.unmetToast", { n: r.unmet.length }), { icon: "⚠️" });
      }
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.updateFailed"));
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
      toast.success(t("cell.cascadeDone", { n: res.data.updated }));
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.updateFailed"));
      setSaving(false);
    }
  };

  // Save just the note, preserving any shift/absence already on the cell. A
  // cleared note on an otherwise-empty cell removes the cell entirely.
  const saveNote = async () => {
    const text = note.trim();
    if (text === (existing?.notes ?? "").trim()) return; // nothing changed
    if (!text && !existing) {
      onClose();
      return;
    }
    if (!text && existing && !existing.shift_type_id && !existing.absence_code) {
      return clear(); // note-only cell, note removed → delete the cell
    }
    setSaving(true);
    try {
      await api.put("/roster/cell", {
        employee_id: employee.id,
        work_date: dateStr,
        shift_type_id: existing?.shift_type_id ?? null,
        absence_code: existing?.absence_code ?? null,
        site_id: cellSite,
        substitutes_for_id: existing?.substitutes_for_id ?? null,
        notes: text || null,
      });
      toast.success(text ? t("cell.noteSaved") : t("cell.noteRemoved"));
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.saveFailed"));
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await api.delete("/roster/cell", {
        params: { employee_id: employee.id, work_date: dateStr },
      });
      toast.success(t("cell.cleared"));
      onDone();
    } catch {
      toast.error(t("cell.failed"));
      setSaving(false);
    }
  };

  // Bench this person as pending. If they currently hold a home-house shift and
  // someone else is already pending today, swap: that person takes the shift so
  // coverage stays intact and this person becomes pending.
  const markPending = async () => {
    setSaving(true);
    try {
      const canSwap =
        existing?.shift_type_id != null &&
        existing.site_id == null &&
        dayPendingPerson != null;
      if (canSwap) {
        await api.put("/roster/cell", {
          employee_id: dayPendingPerson!.id,
          work_date: dateStr,
          shift_type_id: existing!.shift_type_id,
        });
      }
      await api.put("/roster/cell", {
        employee_id: employee.id,
        work_date: dateStr,
        is_pending: true,
      });
      toast.success(
        canSwap
          ? t("cell.pendingSwapped", {
              holder: dayPendingPerson!.name,
              emp: employee.first_name,
            })
          : t("cell.pendingSet", { name: employee.first_name })
      );
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("cell.failed"));
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
      toast.error(t("cell.subsLoadFailed"));
    }
  };

  // Click a suggested substitute to assign them to the gap shift. A substitute
  // from another house is placed on loan (site override) to the gap's house.
  const assignSub = async (s: SubstituteCandidate) => {
    if (gapShiftId == null) {
      toast.error(t("cell.noShiftToCover"));
      return;
    }
    const code = shiftTypes.find((st) => st.id === gapShiftId)?.code ?? "?";
    setSaving(true);
    try {
      const gapHouse = primarySite ?? employee.site_id ?? null;
      await api.put("/roster/cell", {
        employee_id: s.employee_id,
        work_date: dateStr,
        shift_type_id: gapShiftId,
        substitutes_for_id: employee.id,
        ...(s.is_cross_site && gapHouse != null ? { site_id: gapHouse } : {}),
      });
      toast.success(t("cell.assignedToCover", { name: s.name, code }));
      onDone();
    } catch (e: any) {
      toast.error(
        e.response?.data?.detail?.toString() || t("cell.assignSubFailed")
      );
      setSaving(false);
    }
  };

  // Apply one absence code across several picked days at once (e.g. Ferie/B).
  const toggleBulkDay = (d: number) =>
    setBulkDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const applyBulkAbsence = async () => {
    const daysList = [...bulkDays].sort((a, b) => a - b);
    if (daysList.length === 0) return;
    setSaving(true);
    try {
      for (const d of daysList) {
        const ds = `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(
          2,
          "0"
        )}`;
        await api.put("/roster/cell", {
          employee_id: employee.id,
          work_date: ds,
          absence_code: bulkCode,
        });
      }
      toast.success(t("cell.absenceApplied", { code: bulkCode, n: daysList.length }));
      onDone();
    } catch (e: any) {
      toast.error(
        e.response?.data?.detail?.toString() || t("cell.absenceFailed")
      );
      setSaving(false);
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
          {t("cell.shift")}
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
              {t("cell.overWarnTitle", {
                code: overWarn.code,
                name: overWarn.holder.name,
                date: dateStr,
                req: overWarn.req,
              })}
            </p>
            <p className="mt-1 text-xs text-warning-700">
              {t("cell.overWarnBody", {
                code: overWarn.code,
                emp: `${employee.first_name} ${employee.last_name}`,
                holder: overWarn.holder.name,
              })}
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" onClick={doSwap} loading={saving}>
                {t("cell.swapWith", { name: overWarn.holder.name })}
              </Button>
              <Button variant="ghost" onClick={() => setOverWarn(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          {t("cell.absence")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
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
              title={t(`abs.${code}`)}
            >
              {code}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBulkOpen((o) => !o)}
            className="rounded-lg border border-dashed border-neutral-400 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            {t("cell.multipleDays")}
          </button>
        </div>

        {bulkOpen && (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs text-neutral-600">
              {t("cell.bulkHint")}
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ABSENCE_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setBulkCode(code)}
                  title={t(`abs.${code}`)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs font-medium " +
                    (bulkCode === code
                      ? "border-warning-700 bg-warning-50 text-warning-700"
                      : "border-neutral-300 hover:bg-neutral-100")
                  }
                >
                  {code}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: daysInMonth(yy, mm) }, (_, i) => i + 1).map(
                (d) => {
                  const on = bulkDays.has(d);
                  const dow = new Date(yy, mm - 1, d).getDay();
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleBulkDay(d)}
                      className={
                        "h-7 w-7 rounded text-xs " +
                        (on
                          ? "bg-warning-500 font-semibold text-white"
                          : (dow === 0 ? "text-danger-600 " : "text-neutral-700 ") +
                            "hover:bg-neutral-200")
                      }
                    >
                      {d}
                    </button>
                  );
                }
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500">
                {t("cell.daysSelected", { n: bulkDays.size })}
              </span>
              <Button
                variant="secondary"
                onClick={applyBulkAbsence}
                loading={saving}
                disabled={saving || bulkDays.size === 0}
              >
                {t("cell.applyTo", { code: bulkCode, n: bulkDays.size })}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          {t("cell.rotation")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {existing?.is_pending ? (
            <button
              disabled={saving}
              onClick={clear}
              className="rounded-lg border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-600 italic"
            >
              {t("cell.pendingUnbench")}
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={markPending}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              title={t("cell.pendingBenchHint")}
            >
              {t("cell.markPending")}
            </button>
          )}
          {!existing?.is_pending &&
            existing?.shift_type_id != null &&
            existing.site_id == null &&
            dayPendingPerson && (
              <span className="text-[11px] text-neutral-400">
                {t("cell.swapsTo", { name: dayPendingPerson.name })}
              </span>
            )}
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase text-neutral-500">
          {t("cell.commentNote")}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          disabled={saving}
          placeholder={t("cell.notePlaceholder")}
          className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            {note.length}/300
          </span>
          <Button
            variant="secondary"
            onClick={saveNote}
            loading={saving}
            disabled={
              saving || note.trim() === (existing?.notes ?? "").trim()
            }
          >
            {note.trim() ? t("cell.saveNote") : t("cell.removeNote")}
          </Button>
        </div>

        {/* Human-in-the-loop substitution helper */}
        <div className="mt-5 border-t border-neutral-200 pt-4">
          <button
            onClick={loadSubs}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            {t("cell.findSubs", { role: employee.job_title })}
          </button>
          {subs && (
            <div className="mt-3 space-y-2">
              {subs.length === 0 && (
                <p className="text-sm text-neutral-500">
                  {t("cell.noSubs")}
                </p>
              )}
              {subs.map((s) => (
                <button
                  key={s.employee_id}
                  onClick={() => assignSub(s)}
                  disabled={saving}
                  title={`Assign ${s.name} to cover this shift`}
                  className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:border-primary-400 hover:bg-primary-50/50 disabled:opacity-50"
                >
                  <div>
                    <span className="font-medium text-primary-700">{s.name}</span>
                    {s.on_rest && (
                      <span className="ml-2 rounded bg-success-50 px-1.5 py-0.5 text-[10px] text-success-700">
                        {t("cell.restDay")}
                      </span>
                    )}
                    {s.is_cross_role && (
                      <span className="ml-2 text-[10px] text-info-500">
                        {t("cell.crossRole")}
                      </span>
                    )}
                    {s.is_cross_site && (
                      <span className="ml-2 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] text-warning-700">
                        {t("cell.otherHouse")}
                      </span>
                    )}
                    <span className="block text-[11px] text-neutral-400">
                      {t("cell.hoursLeft", { h: s.remaining_hours })}
                      {s.would_cause_overtime ? t("cell.wouldOvertime") : ""}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {s.job_title} →
                  </span>
                </button>
              ))}
              <p className="text-[11px] text-neutral-400 pt-1">
                {t("cell.clickToAssignSub")}
              </p>
            </div>
          )}
        </div>

        {savedOnce && savedKind === "absence" && (
          <div className="mt-5 rounded-lg border border-warning-300 bg-warning-50/50 p-3">
            <p className="text-sm font-medium text-neutral-800">
              {t("cell.onLeaveTitle", {
                name: employee.first_name,
                shift: gapShiftId
                  ? t("cell.onLeaveShift", {
                      code: shiftTypes.find((s) => s.id === gapShiftId)?.code ?? "",
                    })
                  : "",
              })}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("cell.onLeaveBody")}
            </p>
            <div className="mt-2">
              <Button variant="secondary" onClick={loadSubs}>
                {t("cell.findCover")}
              </Button>
            </div>
          </div>
        )}

        {savedOnce && savedKind === "shift" && pattern && (
          <div className="mt-5 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
            <p className="text-sm font-medium text-neutral-800">
              {t("cell.applyRest")}
            </p>
            <p className="mb-3 text-xs text-neutral-500">
              {t("cell.manualLocked")}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={cascadePerson}
                loading={saving}
              >
                {t("cell.cascadeBtn", { name: employee.first_name })}
              </Button>
              <Button
                variant="secondary"
                onClick={autoUpdateMonth}
                loading={saving}
              >
                {t("cell.regenBtn")}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            {savedOnce ? t("cell.doneKeep") : t("common.close")}
          </Button>
          {existing && !savedOnce && (
            <Button variant="danger" onClick={clear} loading={saving}>
              {t("cell.clearCell")}
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
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [autoStagger, setAutoStagger] = useState(true);
  const [result, setResult] = useState<AutoFillResult | null>(null);
  // When a house has more staff than the coverage needs, ask who sits out.
  const [pendingPicker, setPendingPicker] = useState<{
    pattern: RotationPattern;
    employees: Employee[];
    total: number;
    selected: Set<number>;
  } | null>(null);

  const codeOf = (id: number) => shiftTypes.find((s) => s.id === id)?.code ?? "?";
  const labelOf = (jt: string) =>
    jobTitles.find((j) => j.name === jt)?.label ?? jt;
  const coverageTotal = (p: RotationPattern) =>
    p.coverage.reduce((s, c) => s + c.required_count, 0);

  // Show the rotation(s) for the active category first, if one is filtered.
  const ordered = [...rotations].sort((a, b) =>
    a.job_title === activeJobTitle ? -1 : b.job_title === activeJobTitle ? 1 : 0
  );

  // Coverage patterns with surplus staff first prompt for who's pending.
  const startRun = async (pattern: RotationPattern) => {
    if (pattern.coverage.length === 0) {
      doRun(pattern, []);
      return;
    }
    const total = coverageTotal(pattern);
    try {
      const res = await api.get("/employees", {
        params: {
          is_active: true,
          job_title: pattern.job_title,
          ...(pattern.site_id != null ? { site_id: pattern.site_id } : {}),
        },
      });
      const emps = res.data as Employee[];
      if (emps.length > total) {
        // Pre-select the surplus (last n − total by name) as a one-click default.
        const surplus = emps.slice(total);
        setPendingPicker({
          pattern,
          employees: emps,
          total,
          selected: new Set(surplus.map((e) => e.id)),
        });
      } else {
        doRun(pattern, []);
      }
    } catch {
      doRun(pattern, []); // if the pre-check fails, just fill
    }
  };

  const doRun = async (pattern: RotationPattern, pendingIds: number[]) => {
    setRunning(true);
    setResult(null);
    setPendingPicker(null);
    try {
      const res = await api.post("/roster/auto-fill", {
        year,
        month,
        pattern_id: pattern.id,
        auto_stagger: autoStagger,
        pending_employee_ids: pendingIds,
        ...(departmentId !== "" ? { department_id: departmentId } : {}),
      });
      const r = res.data as AutoFillResult;
      setResult(r);
      if (r.employees_filled === 0) {
        toast.error(t("af.noneScheduled"));
      } else {
        toast.success(
          t("af.filledCells", {
            cells: r.filled_cells,
            emps: r.employees_filled,
          })
        );
      }
      onReload(); // refresh the grid behind the modal
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("common.failed"));
    } finally {
      setRunning(false);
    }
  };

  if (pendingPicker) {
    const { pattern, employees, total, selected } = pendingPicker;
    const n = employees.length;
    const surplus = n - total;
    const balanced = selected.size === surplus;
    const toggle = (id: number) =>
      setPendingPicker((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { ...prev, selected: next };
      });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                {t("af.whoSitsOut")}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                {t("af.surplusDesc", {
                  pattern: pattern.name,
                  n,
                  total,
                  surplus,
                })}
              </p>
            </div>
            <button
              onClick={() => setPendingPicker(null)}
              className="text-neutral-400 hover:text-neutral-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 space-y-1">
            {employees.map((e) => {
              const on = selected.has(e.id);
              return (
                <label
                  key={e.id}
                  className={
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer " +
                    (on ? "bg-neutral-100 text-neutral-500" : "hover:bg-neutral-50")
                  }
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(e.id)}
                  />
                  <span className={on ? "italic" : "font-medium"}>
                    {e.last_name} {e.first_name}
                  </span>
                  {on && (
                    <span className="ml-auto text-[11px] text-neutral-400">
                      {t("af.pending")}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <p
            className={
              "mt-2 text-[11px] " +
              (balanced ? "text-success-700" : "text-warning-700")
            }
          >
            {t("af.selectedCount", { n: selected.size })}
            {balanced
              ? t("af.balanced", { total })
              : t("af.pickToBalance", {
                  surplus,
                  working: n - selected.size,
                  total,
                })}
          </p>

          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => setPendingPicker(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => doRun(pattern, [...selected])}
              loading={running}
              disabled={running}
            >
              {t("af.fillWithPending", {
                working: n - selected.size,
                pending: selected.size,
              })}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {t("af.title", { month: monthLabel, year })}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">{t("af.desc")}</p>
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
                {t("af.staggerTitle")}
              </span>
              <span className="block text-xs text-neutral-500">
                {t("af.staggerDesc")}
              </span>
            </span>
          </label>
        )}

        <div className="mt-4 space-y-3">
          {ordered.length === 0 && (
            <p className="text-sm text-neutral-500">{t("af.noLibs")}</p>
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
                      {coverageMode &&
                        ` · ${t("af.minRest", { h: p.min_rest_hours })}`}
                    </div>
                  </div>
                  <Button
                    onClick={() => startRun(p)}
                    loading={running}
                    disabled={running}
                  >
                    {t("af.fillMonth")}
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
                        {t("af.dailyCoverage")}
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
                        {t("af.dayCycle", { n: p.shift_type_ids.length })}
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
                  {t("af.checkBalance")}
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {result.alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              {t("af.filledCells", {
                cells: result.filled_cells,
                emps: result.employees_filled,
              })}
            </div>

            {result.unmet.length > 0 && (
              <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
                <div className="font-medium">
                  {t("af.unmetTitle", { n: result.unmet.length })}
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
                {t("af.skipped", { names: result.skipped.join(", ") })}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

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
  const { t } = useI18n();
  const [keepAbsences, setKeepAbsences] = useState(true);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    try {
      const res = await api.delete("/roster/month", {
        params: { ...params, keep_absences: keepAbsences },
      });
      toast.success(t("clearm.cleared", { n: res.data.cleared }));
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || t("clearm.failed"));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">
            {t("clearm.title", { month: monthLabel, year })}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          {t("clearm.body", {
            scope: scope ? scope : t("clearm.allStaff"),
            month: monthLabel,
            year,
          })}
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
              {t("clearm.keepAbsences")}
            </span>
            <span className="block text-xs text-neutral-500">
              {t("clearm.keepAbsencesDesc")}
            </span>
          </span>
        </label>
        <div className="mt-5 flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={clear} loading={busy}>
            {t("ros.clearMonth")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function HistoryModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null);

  useEffect(() => {
    api
      .get("/roster/history", { params: { limit: 150 } })
      .then((r) => setEntries(r.data))
      .catch(() => toast.error(t("hist.loadFailed")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {t("hist.title")}
            </h3>
            <p className="text-sm text-neutral-500">{t("hist.subtitle")}</p>
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
              {t("hist.none")}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="mt-0.5 shrink-0 rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                    {t(`hist.${e.action}`) !== `hist.${e.action}`
                      ? t(`hist.${e.action}`)
                      : e.action}
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
            {t("common.close")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
