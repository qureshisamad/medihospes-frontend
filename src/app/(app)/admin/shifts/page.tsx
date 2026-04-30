"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CalendarView from "@/components/calendar/CalendarView";
import type { Clinic } from "@/lib/types";

export default function AdminShiftsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState({
    clinic_id: "",
    required_role: "administrative",
    shift_type: "morning",
    start_time: "",
    end_time: "",
    max_capacity: "1",
    notes: "",
  });

  useEffect(() => {
    api.get("/clinics").then((r) => setClinics(r.data));
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/shifts", {
        ...form,
        clinic_id: Number(form.clinic_id),
        max_capacity: Number(form.max_capacity),
      });
      toast.success("Shift published!");
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to publish";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Manage Shifts</h1>
          <p className="mt-1 text-neutral-500">
            Publish and manage open shifts
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          New Shift
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handlePublish} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Clinic
                </label>
                <select
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm"
                  value={form.clinic_id}
                  onChange={(e) =>
                    setForm({ ...form, clinic_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select clinic</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Required Role
                </label>
                <select
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm"
                  value={form.required_role}
                  onChange={(e) =>
                    setForm({ ...form, required_role: e.target.value })
                  }
                >
                  {[
                    "administrative",
                    "nurse",
                    "doctor",
                    "technician",
                    "support",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Shift Type
                </label>
                <select
                  className="h-12 rounded-lg border border-neutral-300 px-3 text-sm"
                  value={form.shift_type}
                  onChange={(e) =>
                    setForm({ ...form, shift_type: e.target.value })
                  }
                >
                  {["morning", "evening", "night"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Max Capacity"
                type="number"
                min="1"
                value={form.max_capacity}
                onChange={(e) =>
                  setForm({ ...form, max_capacity: e.target.value })
                }
                required
              />
              <Input
                label="Start Time"
                type="datetime-local"
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
                required
              />
              <Input
                label="End Time"
                type="datetime-local"
                value={form.end_time}
                onChange={(e) =>
                  setForm({ ...form, end_time: e.target.value })
                }
                required
              />
            </div>
            <Input
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                Publish Shift
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <CalendarView key={refreshKey} isAdmin={true} />
    </div>
  );
}
