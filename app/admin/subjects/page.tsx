"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { FlkTrack, Subject } from "@/lib/types/admin";

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [form, setForm] = useState({
    id: "",
    name: "",
    track: "FLK 1" as FlkTrack,
    order: 1,
    published: true,
  });

  const load = async () => {
    const rows = await adminApi.listSubjects();
    setSubjects(rows as Subject[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load subjects." }));
  }, []);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.upsertSubject(form);
      setFeedback({ type: "success", message: "Subject saved." });
      setForm({ id: "", name: "", track: "FLK 1", order: 1, published: true });
      await load();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell title="Subjects" subtitle="Manage FLK subject structure used across books, audio, MCQs, and mocks.">
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit Subject" : "Add Subject"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Subject name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={form.track}
                onChange={(event) => setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option>FLK 1</option>
                <option>FLK 2</option>
              </select>
              <input
                type="number"
                value={form.order}
                onChange={(event) => setForm((prev) => ({ ...prev, order: Number(event.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                />
                Published
              </label>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
                Save subject
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Current Subjects</h3>
            <div className="mt-4 space-y-2">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() =>
                    setForm({
                      id: subject.id,
                      name: subject.name,
                      track: subject.track,
                      order: subject.order,
                      published: subject.published,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left"
                >
                  <p className="font-medium">{subject.name}</p>
                  <p className="text-xs text-slate-500">
                    {subject.track} • Order {subject.order}
                  </p>
                </button>
              ))}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
