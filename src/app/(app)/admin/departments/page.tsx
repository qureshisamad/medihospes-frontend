"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api
      .get("/departments")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Failed to load departments"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchItems, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "" });
    setShowForm(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, form);
        toast.success("Updated");
      } else {
        await api.post("/departments", form);
        toast.success("Created");
      }
      setShowForm(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (d: Department) => {
    if (!confirm(`Delete department ${d.name}?`)) return;
    try {
      await api.delete(`/departments/${d.id}`);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Departments</h1>
          <p className="mt-1 text-neutral-500">Administrative, OSS, Auxiliaries, COC…</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> Add Department
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? "Edit Department" : "New Department"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editing ? "Save Changes" : "Create"}
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
          {items.map((d) => (
            <Card key={d.id} className="flex items-center gap-4">
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
                {d.code}
              </div>
              <div className="flex-1 font-semibold text-neutral-900">{d.name}</div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(d)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => remove(d)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-danger-50 hover:text-danger-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
