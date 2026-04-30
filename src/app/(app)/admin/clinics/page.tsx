"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Clinic } from "@/lib/types";

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  const fetchClinics = () => {
    api.get("/clinics").then((r) => setClinics(r.data));
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/clinics", form);
      toast.success("Clinic created!");
      setShowForm(false);
      setForm({ name: "", code: "", address: "" });
      fetchClinics();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create clinic");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clinics</h1>
          <p className="mt-1 text-neutral-500">Manage clinic locations</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          Add Clinic
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Clinic Name"
                placeholder="Messina I"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Code"
                placeholder="ME-I"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <Input
              label="Address (optional)"
              placeholder="Via Roma 1, Messina"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                Create Clinic
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clinics.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary-50 p-2">
                <MapPin size={20} className="text-primary-500" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">{c.name}</h3>
                <p className="text-sm text-neutral-500">{c.code}</p>
                {c.address && (
                  <p className="text-xs text-neutral-500 mt-1">{c.address}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
