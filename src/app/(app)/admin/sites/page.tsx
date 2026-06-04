"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Site } from "@/lib/types";

export default function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    api
      .get("/sites")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Failed to load sites"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchItems, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", address: "" });
    setShowForm(true);
  };
  const openEdit = (s: Site) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code, address: s.address || "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { ...form, address: form.address || null };
    try {
      if (editing) {
        await api.patch(`/sites/${editing.id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/sites", payload);
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

  const remove = async (s: Site) => {
    if (!confirm(`Delete site ${s.name}?`)) return;
    try {
      await api.delete(`/sites/${s.id}`);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Sites</h1>
          <p className="mt-1 text-neutral-500">Physical facilities / locations</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} /> Add Site
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editing ? "Edit Site" : "New Site"}
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
            <Input
              label="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
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
            <Card key={s.id} className="flex items-center gap-4">
              <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
                {s.code}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-neutral-900">{s.name}</div>
                {s.address && (
                  <div className="text-xs text-neutral-500">{s.address}</div>
                )}
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
