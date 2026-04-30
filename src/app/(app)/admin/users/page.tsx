"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import type { User, JobTitleRecord } from "@/lib/types";

type FormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  codice_fiscale: string;
  role: "staff" | "admin";
  job_title: string;
  contract_type: string;
  weekly_hour_limit: string;
};

const emptyForm: FormData = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  codice_fiscale: "",
  role: "staff",
  job_title: "",
  contract_type: "full_time",
  weekly_hour_limit: "36",
};

const CONTRACT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "staff" | "admin">("all");

  const fetchUsers = () => {
    setLoading(true);
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    api
      .get<JobTitleRecord[]>("/job-titles")
      .then((r) => setJobTitles(r.data))
      .catch(() => {});
  }, []);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      first_name: user.first_name,
      last_name: user.last_name,
      codice_fiscale: user.codice_fiscale || "",
      role: user.role,
      job_title: user.job_title,
      contract_type: user.contract_type,
      weekly_hour_limit: String(user.weekly_hour_limit),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update existing user
        const payload: Record<string, unknown> = {
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          codice_fiscale: form.codice_fiscale || null,
          role: form.role,
          job_title: form.job_title,
          contract_type: form.contract_type,
          weekly_hour_limit: parseFloat(form.weekly_hour_limit),
        };
        await api.patch(`/users/${editingUser.id}`, payload);
        toast.success("User updated!");
      } else {
        // Create new user
        await api.post("/users", {
          ...form,
          codice_fiscale: form.codice_fiscale || null,
          weekly_hour_limit: parseFloat(form.weekly_hour_limit),
        });
        toast.success("User created!");
      }
      setShowForm(false);
      setEditingUser(null);
      setForm(emptyForm);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}/toggle-active`);
      toast.success(
        user.is_active ? "User deactivated" : "User activated"
      );
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update status");
    }
  };

  const filteredUsers =
    filter === "all" ? users : users.filter((u) => u.role === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            User Management
          </h1>
          <p className="mt-1 text-neutral-500">
            Create and manage staff accounts
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus size={18} />
          Add User
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "staff", "admin"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
              (filter === f
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
            }
          >
            {f === "all"
              ? `All (${users.length})`
              : f === "staff"
                ? `Staff (${users.filter((u) => u.role === "staff").length})`
                : `Admins (${users.filter((u) => u.role === "admin").length})`}
          </button>
        ))}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editingUser ? "Edit User" : "New User"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="Maria"
                value={form.first_name}
                onChange={(e) =>
                  setForm({ ...form, first_name: e.target.value })
                }
                required
              />
              <Input
                label="Last Name"
                placeholder="Rossi"
                value={form.last_name}
                onChange={(e) =>
                  setForm({ ...form, last_name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="user@medihospes.it"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              {!editingUser && (
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Codice Fiscale (optional)"
                placeholder="RSSMRA85M01F158Y"
                value={form.codice_fiscale}
                onChange={(e) =>
                  setForm({ ...form, codice_fiscale: e.target.value })
                }
              />
              <Input
                label="Weekly Hour Limit"
                type="number"
                placeholder="36"
                value={form.weekly_hour_limit}
                onChange={(e) =>
                  setForm({ ...form, weekly_hour_limit: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Role select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "staff" | "admin",
                    })
                  }
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Job title select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Job Title
                </label>
                <select
                  value={form.job_title}
                  onChange={(e) =>
                    setForm({ ...form, job_title: e.target.value })
                  }
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  {jobTitles
                    .filter((jt) => jt.is_active)
                    .map((jt) => (
                    <option key={jt.name} value={jt.name}>
                      {jt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contract type select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Contract Type
                </label>
                <select
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm({ ...form, contract_type: e.target.value })
                  }
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editingUser ? "Save Changes" : "Create User"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Users list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">No users found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => (
            <Card
              key={u.id}
              className={
                "flex items-center gap-4" +
                (!u.is_active ? " opacity-60" : "")
              }
            >
              {/* Avatar circle */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
                {u.first_name[0]}
                {u.last_name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-neutral-900">
                    {u.first_name} {u.last_name}
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                      (u.role === "admin"
                        ? "bg-primary-100 text-primary-700"
                        : "bg-neutral-100 text-neutral-700")
                    }
                  >
                    {u.role}
                  </span>
                  {!u.is_active && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{u.email}</span>
                  <span className="capitalize">
                    {u.job_title} · {u.contract_type.replace("_", " ")} ·{" "}
                    {u.weekly_hour_limit}h/week
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEditForm(u)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                  title="Edit user"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  className={
                    "rounded-lg p-2 transition-colors " +
                    (u.is_active
                      ? "text-neutral-500 hover:bg-danger-50 hover:text-danger-500"
                      : "text-neutral-500 hover:bg-success-50 hover:text-success-500")
                  }
                  title={u.is_active ? "Deactivate user" : "Activate user"}
                >
                  {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
