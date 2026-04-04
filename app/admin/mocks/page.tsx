"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { normalizeMockQuestionIds } from "@/lib/normalize-mock-question-ids";
import type { FlkTrack, Mcq, MockExam, Subject } from "@/lib/types/admin";

function mcqKey(mcq: Mcq): string {
  return String(mcq.id);
}

export default function AdminMocksPage() {
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [mcqSearch, setMcqSearch] = useState("");
  const [filterByMockTrack, setFilterByMockTrack] = useState(true);
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
    load().catch((error) =>
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? `Failed to load mock exam data: ${error.message}` : "Failed to load mock exam data.",
      }),
    );
  }, []);

  const mcqsForPicker = useMemo(() => {
    const want = form.track.replace(/\s/g, "").toLowerCase();
    const pool = filterByMockTrack
      ? (() => {
          const byTrack = mcqs.filter((mcq) => {
            const got = (mcq.track || "").replace(/\s/g, "").toLowerCase();
            return got === want || got === "";
          });
          return byTrack.length ? byTrack : mcqs;
        })()
      : mcqs;
    const q = mcqSearch.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((item) => item.question.toLowerCase().includes(q));
  }, [form.track, mcqSearch, mcqs, filterByMockTrack]);

  const selectedMcqsOrdered = useMemo(() => {
    const byId = new Map(mcqs.map((m) => [mcqKey(m), m]));
    return form.questionIds.map((qid) => {
      const found = byId.get(String(qid));
      if (found) return found;
      return {
        id: String(qid),
        subjectId: "",
        subjectName: "",
        track: form.track,
        question: `Unknown or deleted MCQ (id: ${String(qid).slice(0, 24)}…)`,
        options: ["", "", "", "", ""] as [string, string, string, string, string],
        correctOption: 0,
        explanation: "",
        published: false,
      } satisfies Mcq;
    });
  }, [form.questionIds, form.track, mcqs]);

  const toggleArrayValue = useCallback((key: "subjectIds" | "questionIds", value: string) => {
    const v = String(value);
    setForm((prev) => {
      const exists = prev[key].includes(v);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== v) : [...prev[key], v],
      };
    });
  }, []);

  const removeQuestionId = useCallback((id: string) => {
    const s = String(id);
    setForm((prev) => ({ ...prev, questionIds: prev.questionIds.filter((q) => q !== s) }));
  }, []);

  const selectAllVisible = useCallback(() => {
    setForm((prev) => {
      const next = new Set(prev.questionIds.map(String));
      for (const mcq of mcqsForPicker) next.add(mcqKey(mcq));
      return { ...prev, questionIds: [...next] };
    });
  }, [mcqsForPicker]);

  const clearAllQuestions = useCallback(() => {
    setForm((prev) => ({ ...prev, questionIds: [] }));
  }, []);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFeedback({ type: "error", message: "Add a mock title." });
      return;
    }
    if (!form.questionIds.length) {
      setFeedback({
        type: "error",
        message: "Select at least one question below, or use “Add all listed” if the bank is filtered.",
      });
      return;
    }
    setSaving(true);
    const savedCount = form.questionIds.length;
    try {
      await adminApi.upsertMock({
        ...form,
        title: form.title.trim(),
        questionIds: form.questionIds.map(String),
      });
      await adminApi.logAudit({
        action: form.id ? "update_mock" : "create_mock",
        entity: "mock_exam",
        entityId: form.id || undefined,
        details: form.title.trim(),
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
      setFeedback({
        type: "success",
        message: `Mock saved with ${savedCount} question(s).`,
      });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (mock: MockExam) => {
    if (!confirm(`Delete mock "${mock.title}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteMock(mock.id);
      await adminApi.logAudit({ action: "delete_mock", entity: "mock_exam", entityId: mock.id });
      if (form.id === mock.id) {
        setForm((prev) => ({
          ...prev,
          id: "",
          title: "",
          questionIds: [],
          subjectIds: [],
        }));
      }
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
      subjectIds: Array.isArray(mock.subjectIds) ? mock.subjectIds.map(String) : [],
      questionIds: normalizeMockQuestionIds(mock.questionIds).map(String),
      durationMinutes: mock.durationMinutes,
      examMode: mock.examMode,
      revealAnswersInPractice: mock.revealAnswersInPractice,
      published: mock.published,
    });
    setMcqSearch("");
    setFeedback(null);
  };

  const onNewMock = () => {
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
    setMcqSearch("");
    setFeedback(null);
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Mock exams"
        subtitle="Build timed practice and exam mocks from your MCQ bank. Selected questions are saved exactly as listed below."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}

        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">How this screen works</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-600">
            <li>Set the mock title and FLK track, then pick questions from the bank (or turn off FLK filter to see every MCQ).</li>
            <li>Review the numbered list in “Questions in this mock” — that is what students will see.</li>
            <li>Save. Delete uses the server directly (no fragile URL paths).</li>
          </ol>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {form.id ? "Edit mock" : "Create mock"}
              </h3>
              <button
                type="button"
                onClick={onNewMock}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
              >
                New blank form
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={onSave}>
              <FormSection title="Basics">
                <label className="block text-xs font-medium text-slate-600">Title</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. FLK1 Mock — Contract & Tort"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">FLK track</label>
                    <select
                      value={form.track}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option>FLK 1</option>
                      <option>FLK 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Duration (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, durationMinutes: Number(event.target.value) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Subjects tagged (optional)">
                <p className="mb-2 text-xs text-slate-500">
                  Used for linking on subject pages; does not limit which MCQs you can add.
                </p>
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

              <FormSection title="Questions in this mock">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-900">
                    {form.questionIds.length} selected
                    {form.questionIds.length === 1 ? " question" : " questions"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      disabled={!mcqsForPicker.length}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 disabled:opacity-50"
                    >
                      Add all listed
                    </button>
                    <button
                      type="button"
                      onClick={clearAllQuestions}
                      disabled={!form.questionIds.length}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                {selectedMcqsOrdered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No questions yet. Use the bank below to tick MCQs, or “Add all listed” to bulk-add the filtered list.
                  </p>
                ) : (
                  <ol className="max-h-52 space-y-2 overflow-auto rounded-lg border border-slate-200 p-3 text-sm">
                    {selectedMcqsOrdered.map((mcq, idx) => (
                      <li
                        key={`${mcqKey(mcq)}-${idx}`}
                        className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-slate-500">{idx + 1}. </span>
                          <span className="text-slate-800">{mcq.question}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQuestionId(mcq.id)}
                          className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </FormSection>

              <FormSection
                title="Question bank"
                helper="Tick rows to add or remove. Turn off “Match FLK” if your MCQs use a different track label."
              >
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterByMockTrack}
                      onChange={(e) => setFilterByMockTrack(e.target.checked)}
                    />
                    Match mock FLK ({form.track})
                  </label>
                  <span className="text-xs text-slate-500">
                    Showing {mcqsForPicker.length} of {mcqs.length} in bank
                  </span>
                </div>
                <input
                  type="search"
                  value={mcqSearch}
                  onChange={(event) => setMcqSearch(event.target.value)}
                  placeholder="Search question text…"
                  className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-slate-200 p-3">
                  {mcqsForPicker.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      No MCQs match. Create MCQs under Admin → MCQs, clear the search, or disable “Match mock FLK”.
                    </p>
                  ) : (
                    mcqsForPicker.map((mcq) => {
                      const id = mcqKey(mcq);
                      return (
                        <label
                          key={id}
                          className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1 hover:border-slate-200 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={form.questionIds.includes(id)}
                            onChange={() => toggleArrayValue("questionIds", id)}
                          />
                          <span className="text-sm text-slate-800">{mcq.question}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </FormSection>

              <FormSection title="Student experience">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.examMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, examMode: event.target.checked }))}
                  />
                  Exam mode (hide correctness until submit)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.revealAnswersInPractice}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, revealAnswersInPractice: event.target.checked }))
                    }
                  />
                  In practice mode, reveal answer after each question
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                  />
                  Published (visible on student mocks page)
                </label>
              </FormSection>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  disabled={saving}
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : form.id ? "Save changes" : "Create mock"}
                </button>
              </div>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Saved mocks</h3>
            <p className="mt-1 text-sm text-slate-600">
              Question counts use the same rules as the student app. Edit to fix a mock that shows zero questions.
            </p>
            <div className="mt-4 space-y-3">
              {mocks.length === 0 ? (
                <p className="text-sm text-slate-500">No mocks yet.</p>
              ) : (
                mocks.map((mock) => {
                  const n = normalizeMockQuestionIds(mock.questionIds).length;
                  return (
                    <div
                      key={mock.id}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
                    >
                      <p className="font-medium text-slate-900">{mock.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {mock.track} · {n} question{n === 1 ? "" : "s"} · {mock.durationMinutes} min
                        {mock.published ? "" : " · draft"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(mock)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(mock)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
