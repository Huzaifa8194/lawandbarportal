"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { FlkTrack, Mcq, MockExam, Subject } from "@/lib/types/admin";

export default function AdminMocksPage() {
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    title: "",
    track: "FLK 1" as FlkTrack,
    subjectIds: [] as string[],
    questionIds: [] as string[],
    durationMinutes: 90,
    examMode: true,
    revealAnswersInPractice: true,
    published: true,
  });

  const load = async () => {
    const [mocksResp, subjectsResp, mcqsResp] = await Promise.all([
      adminApi.listMocks(),
      adminApi.listSubjects(),
      adminApi.listMcqs(),
    ]);
    setMocks(mocksResp as MockExam[]);
    setSubjects(subjectsResp as Subject[]);
    setMcqs(mcqsResp as Mcq[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load mock exam data." }));
  }, []);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.questionIds.length) {
      setFeedback({ type: "error", message: "Title and at least one MCQ are required." });
      return;
    }
    setSaving(true);
    try {
      await adminApi.upsertMock(form);
      await adminApi.logAudit({
        action: form.id ? "update_mock" : "create_mock",
        entity: "mock_exam",
        entityId: form.id || undefined,
        details: form.title,
      });
      setForm({
        id: "",
        title: "",
        track: "FLK 1",
        subjectIds: [],
        questionIds: [],
        durationMinutes: 90,
        examMode: true,
        revealAnswersInPractice: true,
        published: true,
      });
      await load();
      setFeedback({ type: "success", message: "Mock exam saved." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (mock: MockExam) => {
    if (!confirm(`Delete mock "${mock.title}"?`)) return;
    try {
      await adminApi.deleteMock(mock.id);
      await adminApi.logAudit({ action: "delete_mock", entity: "mock_exam", entityId: mock.id });
      await load();
      setFeedback({ type: "success", message: "Mock exam deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    }
  };

  const onEdit = (mock: MockExam) => {
    setForm({
      id: mock.id,
      title: mock.title,
      track: mock.track,
      subjectIds: mock.subjectIds,
      questionIds: mock.questionIds,
      durationMinutes: mock.durationMinutes,
      examMode: mock.examMode,
      revealAnswersInPractice: mock.revealAnswersInPractice,
      published: mock.published,
    });
  };

  const toggleArrayValue = (key: "subjectIds" | "questionIds", value: string) => {
    setForm((prev) => {
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value],
      };
    });
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Mock Exams Builder"
        subtitle="Assemble mock exams from MCQs with mode controls, timer setup, and publish readiness."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit Mock Exam" : "Create Mock Exam"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <FormSection title="Core settings">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Mock title"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
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
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <FormSection title="Subjects included">
                <div className="grid gap-2 md:grid-cols-2">
                  {subjects
                    .filter((subject) => subject.track === form.track)
                    .map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.subjectIds.includes(subject.id)}
                          onChange={() => toggleArrayValue("subjectIds", subject.id)}
                        />
                        {subject.name}
                      </label>
                    ))}
                </div>
              </FormSection>

              <FormSection title="Questions included">
                <div className="max-h-60 space-y-2 overflow-auto rounded-lg border border-slate-200 p-3">
                  {mcqs
                    .filter((mcq) => mcq.track === form.track)
                    .map((mcq) => (
                      <label key={mcq.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.questionIds.includes(mcq.id)}
                          onChange={() => toggleArrayValue("questionIds", mcq.id)}
                        />
                        <span>{mcq.question}</span>
                      </label>
                    ))}
                </div>
              </FormSection>

              <FormSection title="Mode rules">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.examMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, examMode: event.target.checked }))}
                  />
                  Exam mode enabled (no answers until submit)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.revealAnswersInPractice}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, revealAnswersInPractice: event.target.checked }))
                    }
                  />
                  Reveal answers instantly in practice mode
                </label>
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
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                {saving ? "Saving..." : form.id ? "Update mock" : "Create mock"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Existing Mocks</h3>
            <div className="mt-4 space-y-3">
              {mocks.map((mock) => (
                <div key={mock.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium">{mock.title}</p>
                  <p className="text-sm text-slate-600">
                    {mock.track} • {mock.questionIds.length} questions • {mock.durationMinutes} min
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEdit(mock)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(mock)}
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
