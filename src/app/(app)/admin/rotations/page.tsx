"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type {
  JobTitleRecord,
  RotationPattern,
  ShiftTypeDef,
} from "@/lib/types";

export default function RotationsPage() {
  const [items, setItems] = useState<RotationPattern[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeDef[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RotationPattern | "new" | null>(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get("/rotations"),
      api.get("/shift-types", { params: { is_active: true } }),
      api.get("/job-titles", { params: { is_active: true } }),
    ])
      .then(([r, s, j]) => {
        setItems(r.data);
        setShiftTypes(s.data);
        setJobTitles(j.data);
      })
      .catch(() => toast.error("Failed to load rotations"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAll, []);

  const codeOf = (id: number) => shiftTypes.find((s) => s.id === id)?.code ?? "?";
  const labelOf = (jt: string) =>
    jobTitles.find((j) => j.name === jt)?.label ?? jt;

  const remove = async (p: RotationPattern) => {
    if (!confirm(`Delete rotation "${p.name}"?`)) return;
    try {
      await api.delete(`/rotations/${p.id}`);
      fetchAll();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Rotation Libraries
          </h1>
          <p className="mt-1 text-neutral-500">
            Define the repeating shift cycle for a staff category. The roster
            auto-fill advances each employee through this cycle from their day-1
            shift.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={18} /> Add Rotation
        </Button>
      </div>

      {editing && (
        <RotationEditor
          pattern={editing === "new" ? null : editing}
          shiftTypes={shiftTypes}
          jobTitles={jobTitles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchAll();
          }}
        />
      )}

      {loading ? (
        <div className="h-24 rounded-xl bg-neutral-100 animate-pulse" />
      ) : items.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-neutral-500">
            No rotation libraries yet. Add one to enable month auto-fill.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Card
              key={p.id}
              className={"flex items-center gap-4" + (!p.is_active ? " opacity-50" : "")}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-neutral-900">{p.name}</div>
                <div className="mb-2 text-xs text-neutral-500">
                  {labelOf(p.job_title)}
                  {!p.is_active && " · inactive"}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {p.shift_type_ids.map((id, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-neutral-300">→</span>}
                      <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                        {codeOf(id)}
                      </span>
                    </span>
                  ))}
                  <span className="ml-1 text-[11px] text-neutral-400">
                    ({p.shift_type_ids.length}-day cycle)
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setEditing(p)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => remove(p)}
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

function RotationEditor({
  pattern,
  shiftTypes,
  jobTitles,
  onClose,
  onSaved,
}: {
  pattern: RotationPattern | null;
  shiftTypes: ShiftTypeDef[];
  jobTitles: JobTitleRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(pattern?.name ?? "");
  const [jobTitle, setJobTitle] = useState(
    pattern?.job_title ?? jobTitles[0]?.name ?? ""
  );
  const [cycle, setCycle] = useState<number[]>(pattern?.shift_type_ids ?? []);
  const [addId, setAddId] = useState<number | "">(shiftTypes[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const codeOf = (id: number) => shiftTypes.find((s) => s.id === id)?.code ?? "?";

  const addStep = () => {
    if (addId === "") return;
    setCycle([...cycle, Number(addId)]);
  };
  const removeStep = (i: number) =>
    setCycle(cycle.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cycle.length) return;
    const next = [...cycle];
    [next[i], next[j]] = [next[j], next[i]];
    setCycle(next);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!jobTitle) return toast.error("Pick a category");
    if (cycle.length === 0) return toast.error("Add at least one shift to the cycle");
    setSaving(true);
    const payload = { name, job_title: jobTitle, shift_type_ids: cycle };
    try {
      if (pattern) {
        await api.put(`/rotations/${pattern.id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/rotations", payload);
        toast.success("Created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.detail?.toString() || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">
          {pattern ? "Edit Rotation" : "New Rotation"}
        </h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          placeholder="Educatori standard rotation"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Category
          </label>
          <select
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
          >
            {jobTitles.map((j) => (
              <option key={j.id} value={j.name}>
                {j.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-5 mb-2 text-xs font-medium uppercase text-neutral-500">
        Cycle (in order)
      </p>
      {cycle.length === 0 ? (
        <p className="text-sm text-neutral-400">No steps yet.</p>
      ) : (
        <div className="space-y-2">
          {cycle.map((id, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2"
            >
              <span className="w-6 text-xs text-neutral-400">{i + 1}</span>
              <span className="rounded bg-primary-50 px-2 py-0.5 text-sm font-semibold text-primary-700">
                {codeOf(id)}
              </span>
              <span className="flex-1 text-sm text-neutral-600">
                {shiftTypes.find((s) => s.id === id)?.name}
              </span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === cycle.length - 1}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                onClick={() => removeStep(i)}
                className="rounded p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
        >
          {shiftTypes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={addStep}>
          <Plus size={16} /> Add step
        </Button>
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={save} loading={saving}>
          {pattern ? "Save Changes" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
