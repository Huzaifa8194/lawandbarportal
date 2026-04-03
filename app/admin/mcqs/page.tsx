"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { FlkTrack, Mcq, Subject } from "@/lib/types/admin";

const emptyOptions = ["", "", "", "", ""];

export default function AdminMcqsPage() {
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    question: "",
    explanation: "",
    subjectId: "",
    subjectName: "",
    track: "FLK 1" as FlkTrack,
    options: [...emptyOptions],
    correctOption: 0,
    published: true,
  });

  const load = async () => {
    const [mcqsResp, subjectsResp] = await Promise.all([
      adminApi.listMcqs(),
      adminApi.listSubjects(),
    ]);
    setMcqs(mcqsResp as Mcq[]);
    setSubjects(subjectsResp as Subject[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load MCQs." }));
  }, []);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.question || !form.subjectId || form.options.some((item) => !item.trim())) {
      setFeedback({ type: "error", message: "Question, subject, and all 5 options are required." });
      return;
    }
    setSaving(true);
    try {
      await adminApi.upsertMcq(form);
      await adminApi.logAudit({
        action: form.id ? "update_mcq" : "create_mcq",
        entity: "mcq",
        entityId: form.id || undefined,
        details: form.question.slice(0, 80),
      });
      setForm({
        id: "",
        question: "",
        explanation: "",
        subjectId: "",
        subjectName: "",
        track: "FLK 1",
        options: [...emptyOptions],
        correctOption: 0,
        published: true,
      });
      await load();
      setFeedback({ type: "success", message: "MCQ saved." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (mcq: Mcq) => {
    setForm({
      id: mcq.id,
      question: mcq.question,
      explanation: mcq.explanation,
      subjectId: mcq.subjectId,
      subjectName: mcq.subjectName,
      track: mcq.track,
      options: [...mcq.options],
      correctOption: mcq.correctOption,
      published: mcq.published,
    });
    setFeedback(null);
  };

  const onDelete = async (mcq: Mcq) => {
    if (!confirm("Delete this MCQ?")) return;
    try {
      await adminApi.deleteMcq(mcq.id);
      await adminApi.logAudit({ action: "delete_mcq", entity: "mcq", entityId: mcq.id });
      await load();
      setFeedback({ type: "success", message: "MCQ deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="MCQ Authoring"
        subtitle="Create and maintain five-option MCQs with correct answer and explanation."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit MCQ" : "Add MCQ"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <FormSection title="Question setup">
                <textarea
                  value={form.question}
                  onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                  placeholder="Scenario / question"
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={form.explanation}
                  onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
                  placeholder="Explanation"
                  className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <FormSection title="Classification">
                <select
                  value={form.track}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option>FLK 1</option>
                  <option>FLK 2</option>
                </select>
                <select
                  value={form.subjectId}
                  onChange={(event) => {
                    const selected = subjects.find((item) => item.id === event.target.value);
                    setForm((prev) => ({
                      ...prev,
                      subjectId: event.target.value,
                      subjectName: selected?.name || "",
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </FormSection>

              <FormSection title="Options (exactly five)">
                {form.options.map((value, index) => (
                  <input
                    key={index}
                    value={value}
                    onChange={(event) =>
                      setForm((prev) => {
                        const next = [...prev.options];
                        next[index] = event.target.value;
                        return { ...prev, options: next };
                      })
                    }
                    placeholder={`Option ${index + 1}`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ))}
                <select
                  value={form.correctOption}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, correctOption: Number(event.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {form.options.map((_, index) => (
                    <option key={index} value={index}>
                      Correct answer: Option {index + 1}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                  />
                  Published
                </label>
              </FormSection>
              <button
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                type="submit"
              >
                {saving ? "Saving..." : form.id ? "Update MCQ" : "Create MCQ"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Question Bank</h3>
            <div className="mt-4 space-y-3">
              {mcqs.map((mcq) => (
                <div key={mcq.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium">{mcq.question}</p>
                  <p className="text-sm text-slate-600">
                    {mcq.track} • {mcq.subjectName}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onEdit(mcq)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(mcq)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
