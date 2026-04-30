"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ClinicMap from "@/components/ui/ClinicMap";
import type { Clinic } from "@/lib/types";

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "" });
  const [geocoding, setGeocoding] = useState<number | null>(null);

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

  const handleGeocode = async (clinicId: number) => {
    setGeocoding(clinicId);
    try {
      await api.post(`/clinics/${clinicId}/geocode`);
      toast.success("Location found!");
      fetchClinics();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Could not find location for this address"
      );
    } finally {
      setGeocoding(null);
    }
  };

  const hasMapData = clinics.some(
    (c) => c.latitude != null && c.longitude != null
  );

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

      {/* Map */}
      {hasMapData && <ClinicMap clinics={clinics} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clinics.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary-50 p-2">
                <MapPin size={20} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900">{c.name}</h3>
                <p className="text-sm text-neutral-500">{c.code}</p>
                {c.address && (
                  <p className="text-xs text-neutral-500 mt-1">{c.address}</p>
                )}
                {c.latitude != null && c.longitude != null ? (
                  <p className="text-xs text-success-700 mt-1">
                    📍 Location mapped
                  </p>
                ) : c.address ? (
                  <button
                    onClick={() => handleGeocode(c.id)}
                    disabled={geocoding === c.id}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCw
                      size={12}
                      className={geocoding === c.id ? "animate-spin" : ""}
                    />
                    Find on map
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
