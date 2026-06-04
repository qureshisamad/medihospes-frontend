"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { ShiftTypeDef } from "@/lib/types";

type FormData = {
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  crosses_midnight: boolean;
  notes: string;
};

const emptyForm: FormData = {
  code: "",
  name: "",
  start_time: "08:00",
  end_time: "14:00",
  duration_hours: "6",
  crosses_midnight: false,
  notes: "",
};

export default function ShiftTypesPage() {
  const [items, setItems] = useState<ShiftTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShiftTypeDef | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api
      .get("/shift-types")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Failed to load shift types"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchItems, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s: ShiftTypeDef) => {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      duration_hours: String(s.duration_hours),
      crosses_midnight: s.crosses_midnight,
      notes: s.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      code: form.code,
      name: form.name,
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      duration_hours: parseFloat(form.duration_hours),
      crosses_midnight: form.crosses_midnight,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await api.patch(`/shift-types/${editing.id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/shift-types", payload);
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

  const remove = async (s: ShiftTypeDef) => {
    if (!confirm(`Deactivate shift type ${s.code}?`)) return;
    try {
      await api.delete(`/shift-types/${s.id}`);
      fetchItems();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Shift Types</h1>
          <p className="mt-1 text-neutral-500">
            Configurable shift definitions used across the roster
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> Add Shift Type
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? "Edit Shift Type" : "New Shift Type"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Code"
                placeholder="A"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
              <Input
                label="Name"
                placeholder="Morning"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
              <Input
                label="End"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
              />
              <Input
                label="Duration (h)"
                type="number"
                step="0.25"
                value={form.duration_hours}
                onChange={(e) =>
                  setForm({ ...form, duration_hours: e.target.value })
                }
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.crosses_midnight}
                onChange={(e) =>
                  setForm({ ...form, crosses_midnight: e.target.checked })
                }
              />
              Crosses midnight
            </label>
            <Input
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
          {items.map((s) => (
            <Card
              key={s.id}
              className={"flex items-center gap-4" + (!s.is_active ? " opacity-50" : "")}
            >
              <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
                {s.code}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-neutral-900">{s.name}</div>
                <div className="text-xs text-neutral-500">
                  {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} ·{" "}
                  {s.duration_hours}h
                  {s.crosses_midnight && " · crosses midnight"}
                  {!s.is_active && " · inactive"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => remove(s)}
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
