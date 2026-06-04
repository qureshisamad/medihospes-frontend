"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
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

  const fetchEmployees = () => {
    setLoading(true);
    api
      .get("/employees")
      .then((r) => setEmployees(r.data))
      .catch(() => toast.error("Failed to load employees"))
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
      coverable_roles: form.coverable_roles,
    };
    try {
      if (editing) {
        await api.patch(`/employees/${editing.id}`, payload);
        toast.success("Employee updated");
      } else {
        await api.post("/employees", payload);
        toast.success("Employee created");
      }
      setShowForm(false);
      setEditing(null);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Operation failed");
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
          <h1 className="text-2xl font-bold text-neutral-900">Employees</h1>
          <p className="mt-1 text-neutral-500">
            Scheduled staff and their contracts (no system access)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> Add Employee
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? "Edit Employee" : "New Employee"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
              <Input
                label="Last Name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Codice Fiscale (optional)"
                value={form.codice_fiscale}
                onChange={(e) =>
                  setForm({ ...form, codice_fiscale: e.target.value })
                }
              />
              <Input
                label="Location (optional)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Department
                </label>
                <select
                  value={form.department_id}
                  onChange={(e) =>
                    setForm({ ...form, department_id: e.target.value })
                  }
                  className={selectCls}
                  required
                >
                  <option value="" disabled>Select…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Site</label>
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
                  Role
                </label>
                <select
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  className={selectCls}
                  required
                >
                  <option value="" disabled>Select…</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.name} value={jt.name}>{jt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Contract Type
                </label>
                <select
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm({ ...form, contract_type: e.target.value })
                  }
                  className={selectCls}
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                </select>
              </div>
              <Input
                label="Monthly Hour Limit"
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
                Flexible shift (rotates weekly)
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.flexible_location}
                  onChange={(e) =>
                    setForm({ ...form, flexible_location: e.target.checked })
                  }
                />
                Flexible location (rotates weekly)
              </label>
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">
                Can also cover roles (cross-role substitution)
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
                {editing ? "Save Changes" : "Create Employee"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
      ) : employees.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">No employees yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {employees.map((e) => (
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
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {deptName(e.department_id)} ·{" "}
                  {e.contract_type.replace("_", " ")} · {e.monthly_hour_limit}h/mo
                  {e.coverable_roles.length > 0 &&
                    ` · covers: ${e.coverable_roles.join(", ")}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(e)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => toggleActive(e)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title={e.is_active ? "Deactivate" : "Activate"}
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
