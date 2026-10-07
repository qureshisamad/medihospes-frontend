"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useT } from "@/lib/i18n";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type {
  Department,
  Employee,
  JobTitleRecord,
  Site,
} from "@/lib/types";

type FormData = {
  first_name: string;
  last_name: string;
  codice_fiscale: string;
  department_id: string;
  site_id: string;
  job_title: string;
  location: string;
  contract_type: string;
  monthly_hour_limit: string;
  flexible_shift: boolean;
  flexible_location: boolean;
  shift_restriction: string;
  coverable_roles: string[];
};

const emptyForm: FormData = {
  first_name: "",
  last_name: "",
  codice_fiscale: "",
  department_id: "",
  site_id: "",
  job_title: "",
  location: "",
  contract_type: "full_time",
  monthly_hour_limit: "130.35",
  flexible_shift: false,
  flexible_location: false,
  shift_restriction: "",
  coverable_roles: [],
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterSite, setFilterSite] = useState<string>("");
  const [filterJob, setFilterJob] = useState<string>("");
  const t = useT();

  const fetchEmployees = () => {
    setLoading(true);
    api
      .get("/employees")
      .then((r) => setEmployees(r.data))
      .catch(() => toast.error(t("emp.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
    api.get("/departments").then((r) => setDepartments(r.data)).catch(() => {});
    api.get("/sites").then((r) => setSites(r.data)).catch(() => {});
    api
      .get("/job-titles", { params: { is_active: true } })
      .then((r) => setJobTitles(r.data))
      .catch(() => {});
  }, []);

  const deptName = (id: number) =>
    departments.find((d) => d.id === id)?.name ?? "—";
  const siteName = (id: number | null) =>
    sites.find((s) => s.id === id)?.name ?? "—";

  const shown = employees.filter(
    (e) =>
      (filterSite === "" ||
        (filterSite === "none"
          ? e.site_id == null
          : String(e.site_id ?? "") === filterSite)) &&
      (filterJob === "" || e.job_title === filterJob)
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      department_id: departments[0] ? String(departments[0].id) : "",
      job_title: jobTitles[0]?.name ?? "",
    });
    setShowForm(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      first_name: e.first_name,
      last_name: e.last_name,
      codice_fiscale: e.codice_fiscale || "",
      department_id: String(e.department_id),
      site_id: e.site_id ? String(e.site_id) : "",
      job_title: e.job_title,
      location: e.location || "",
      contract_type: e.contract_type,
      monthly_hour_limit: String(e.monthly_hour_limit),
      flexible_shift: e.flexible_shift,
      flexible_location: e.flexible_location,
      shift_restriction: e.shift_restriction || "",
      coverable_roles: e.coverable_roles,
    });
    setShowForm(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      codice_fiscale: form.codice_fiscale || null,
      department_id: Number(form.department_id),
      site_id: form.site_id ? Number(form.site_id) : null,
      job_title: form.job_title,
      location: form.location || null,
      contract_type: form.contract_type,
      monthly_hour_limit: parseFloat(form.monthly_hour_limit),
      flexible_shift: form.flexible_shift,
      flexible_location: form.flexible_location,
      shift_restriction: form.shift_restriction || null,
      coverable_roles: form.coverable_roles,
    };
    try {
      if (editing) {
        await api.patch(`/employees/${editing.id}`, payload);
        toast.success(t("emp.updated"));
      } else {
        await api.post("/employees", payload);
        toast.success(t("emp.created"));
      }
      setShowForm(false);
      setEditing(null);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (e: Employee) => {
    try {
      await api.patch(`/employees/${e.id}`, { is_active: !e.is_active });
      fetchEmployees();
    } catch {
      toast.error("Failed");
    }
  };

  const toggleCover = (role: string) => {
    setForm((f) => ({
      ...f,
      coverable_roles: f.coverable_roles.includes(role)
        ? f.coverable_roles.filter((r) => r !== role)
        : [...f.coverable_roles, role],
    }));
  };

  const selectCls =
    "h-12 rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("emp.title")}</h1>
          <p className="mt-1 text-neutral-500">{t("emp.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> {t("emp.add")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? t("emp.editTitle") : t("emp.newTitle")}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("emp.firstName")}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
              <Input
                label={t("emp.lastName")}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("emp.codiceFiscale")}
                value={form.codice_fiscale}
                onChange={(e) =>
                  setForm({ ...form, codice_fiscale: e.target.value })
                }
              />
              <Input
                label={t("emp.location")}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  {t("emp.department")}
                </label>
                <select
                  value={form.department_id}
                  onChange={(e) =>
                    setForm({ ...form, department_id: e.target.value })
                  }
                  className={selectCls}
                  required
                >
                  <option value="" disabled>{t("emp.selectPlaceholder")}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">{t("emp.site")}</label>
                <select
                  value={form.site_id}
                  onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  className={selectCls}
                >
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  {t("emp.role")}
                </label>
                <select
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  className={selectCls}
                  required
                >
                  <option value="" disabled>{t("emp.selectPlaceholder")}</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.name} value={jt.name}>{jt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  {t("emp.contractType")}
                </label>
                <select
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm({ ...form, contract_type: e.target.value })
                  }
                  className={selectCls}
                >
                  <option value="full_time">{t("emp.fullTime")}</option>
                  <option value="part_time">{t("emp.partTime")}</option>
                </select>
              </div>
              <Input
                label={t("emp.monthlyHourLimit")}
                type="number"
                step="0.01"
                value={form.monthly_hour_limit}
                onChange={(e) =>
                  setForm({ ...form, monthly_hour_limit: e.target.value })
                }
                required
              />
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.flexible_shift}
                  onChange={(e) =>
                    setForm({ ...form, flexible_shift: e.target.checked })
                  }
                />
                {t("emp.flexShift")}
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.flexible_location}
                  onChange={(e) =>
                    setForm({ ...form, flexible_location: e.target.checked })
                  }
                />
                {t("emp.flexLocation")}
              </label>
            </div>

            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                {t("emp.shiftRestriction")}
              </label>
              <select
                value={form.shift_restriction}
                onChange={(e) =>
                  setForm({ ...form, shift_restriction: e.target.value })
                }
                className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              >
                <option value="">{t("emp.shiftRestrictionNone")}</option>
                <option value="morning_only">
                  {t("emp.shiftRestrictionMorning")}
                </option>
              </select>
              <p className="mt-1 text-xs text-neutral-400">
                {t("emp.shiftRestrictionHint")}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">
                {t("emp.coverRoles")}
              </p>
              <div className="flex flex-wrap gap-2">
                {jobTitles
                  .filter((jt) => jt.name !== form.job_title)
                  .map((jt) => (
                    <button
                      key={jt.name}
                      type="button"
                      onClick={() => toggleCover(jt.name)}
                      className={
                        "rounded-lg border px-3 py-1.5 text-sm " +
                        (form.coverable_roles.includes(jt.name)
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-neutral-300 hover:bg-neutral-50")
                      }
                    >
                      {jt.label}
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editing ? t("common.saveChanges") : t("emp.createBtn")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!loading && employees.length > 0 && (
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
            >
              <option value="">{t("emp.allSites")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="none">{t("emp.noSite")}</option>
            </select>
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
            >
              <option value="">{t("emp.allJobTitles")}</option>
              {jobTitles.map((j) => (
                <option key={j.id} value={j.name}>{j.label}</option>
              ))}
            </select>
            {(filterSite || filterJob) && (
              <>
                <button
                  onClick={() => {
                    setFilterSite("");
                    setFilterJob("");
                  }}
                  className="text-sm text-neutral-500 hover:text-neutral-800"
                >
                  {t("emp.clearFilters")}
                </button>
                <span className="text-sm text-neutral-400">
                  {t("emp.ofCount", {
                    shown: shown.length,
                    total: employees.length,
                  })}
                </span>
              </>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
      ) : employees.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">{t("emp.none")}</p>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">
            {t("emp.noMatch")}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((e) => (
            <Card
              key={e.id}
              className={"flex items-center gap-4" + (!e.is_active ? " opacity-60" : "")}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
                {e.first_name[0]}
                {e.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-neutral-900">
                    {e.first_name} {e.last_name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 capitalize">
                    {e.job_title}
                  </span>
                  {e.flexible_shift && (
                    <span className="text-[10px] text-info-500">flex-shift</span>
                  )}
                  {e.flexible_location && (
                    <span className="text-[10px] text-info-500">flex-loc</span>
                  )}
                  {e.shift_restriction === "morning_only" && (
                    <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-medium text-warning-700">
                      {t("emp.shiftRestrictionMorning")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {deptName(e.department_id)}
                  {e.site_id != null && ` · ${siteName(e.site_id)}`} ·{" "}
                  {e.contract_type.replace("_", " ")} · {e.monthly_hour_limit}h/mo
                  {e.coverable_roles.length > 0 &&
                    ` · ${t("emp.covers", {
                      roles: e.coverable_roles.join(", "),
                    })}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(e)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title={t("common.edit")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => toggleActive(e)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title={e.is_active ? t("emp.deactivate") : t("emp.activate")}
                >
                  {e.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
