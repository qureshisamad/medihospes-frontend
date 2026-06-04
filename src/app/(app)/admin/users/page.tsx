"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { User, UserRole } from "@/lib/types";

type FormData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
};

const emptyForm: FormData = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "manager",
};

export default function AccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api
      .get("/users")
      .then((r) => setUsers(r.data))
      .catch(() => toast.error("Failed to load accounts"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchUsers, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: "",
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        toast.success("Account updated");
      } else {
        await api.post("/users", form);
        toast.success("Account created");
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}/toggle-active`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Accounts</h1>
          <p className="mt-1 text-neutral-500">
            Manager &amp; HR login accounts (the only system users)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> Add Account
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? "Edit Account" : "New Account"}
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
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label={editing ? "New Password (optional)" : "Password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <label className="text-sm font-medium text-neutral-700">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as UserRole })
                }
                className="h-12 rounded-lg border border-neutral-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              >
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editing ? "Save Changes" : "Create Account"}
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
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card
              key={u.id}
              className={"flex items-center gap-4" + (!u.is_active ? " opacity-60" : "")}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
                {u.first_name[0]}
                {u.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-neutral-900">
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 uppercase">
                    {u.role}
                  </span>
                  {!u.is_active && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(u)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                  title={u.is_active ? "Deactivate" : "Activate"}
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
