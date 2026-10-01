"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Briefcase, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useT } from "@/lib/i18n";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { JobTitleRecord } from "@/lib/types";

type FormData = {
  name: string;
  label: string;
};

const emptyForm: FormData = { name: "", label: "" };

export default function AdminJobTitlesPage() {
  const t = useT();
  const [jobTitles, setJobTitles] = useState<JobTitleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchJobTitles = () => {
    setLoading(true);
    api
      .get<JobTitleRecord[]>("/job-titles")
      .then((r) => setJobTitles(r.data))
      .catch(() => toast.error(t("jt.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJobTitles();
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (jt: JobTitleRecord) => {
    setEditingId(jt.id);
    setForm({ name: jt.name, label: jt.label });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`/job-titles/${editingId}`, form);
        toast.success(t("jt.updated"));
      } else {
        await api.post("/job-titles", form);
        toast.success(t("jt.created"));
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchJobTitles();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (jt: JobTitleRecord) => {
    try {
      await api.patch(`/job-titles/${jt.id}`, {
        is_active: !jt.is_active,
      });
      toast.success(jt.is_active ? t("jt.deactivated") : t("jt.activated"));
      fetchJobTitles();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("common.failed"));
    }
  };

  // Auto-generate name from label
  const handleLabelChange = (label: string) => {
    const name = label
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, "")
      .replace(/\s+/g, "_")
      .replace(/^_|_$/g, "");
    setForm({ label, name });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{t("jt.title")}</h1>
          <p className="mt-1 text-neutral-500">{t("jt.subtitle")}</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus size={18} />
          {t("jt.add")}
        </Button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {editingId ? t("jt.editTitle") : t("jt.newTitle")}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("jt.field")}
              placeholder={t("jt.placeholder")}
              value={form.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editingId ? t("common.saveChanges") : t("jt.createBtn")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Job titles list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-neutral-100 animate-pulse"
            />
          ))}
        </div>
      ) : jobTitles.length === 0 ? (
        <Card>
          <p className="text-center text-neutral-500 py-6">{t("jt.none")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobTitles.map((jt) => (
            <Card
              key={jt.id}
              className={
                "flex items-center gap-4" +
                (!jt.is_active ? " opacity-60" : "")
              }
            >
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <Briefcase size={18} className="text-primary-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900">
                    {jt.label}
                  </span>
                  {!jt.is_active && (
                    <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
                      {t("common.inactive")}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEditForm(jt)}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                  title={t("common.edit")}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleToggleActive(jt)}
                  className={
                    "rounded-lg p-2 transition-colors " +
                    (jt.is_active
                      ? "text-success-500 hover:bg-neutral-100"
                      : "text-neutral-300 hover:bg-neutral-100")
                  }
                  title={jt.is_active ? t("emp.deactivate") : t("emp.activate")}
                >
                  {jt.is_active ? (
                    <ToggleRight size={20} />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
