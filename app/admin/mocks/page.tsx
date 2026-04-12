"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import McqBankDrawer from "@/app/components/admin/mcq-bank-drawer";
import { adminApi } from "@/lib/services/admin-api";
import { normalizeMockQuestionIds } from "@/lib/normalize-mock-question-ids";
import type { FlkTrack, Mcq, MockExam, Subject } from "@/lib/types/admin";

function mcqKey(mcq: Mcq): string {
  return String(mcq.id);
}

function parseIdList(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const id = p.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export default function AdminMocksPage() {
  const [mocks, setMocks] = useState<MockExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mcqCache, setMcqCache] = useState<Map<string, Mcq>>(() => new Map());

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [bankOpen, setBankOpen] = useState(false);
  const [bankKey, setBankKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);

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

  const selectedIdSet = useMemo(() => new Set(form.questionIds.map(String)), [form.questionIds]);

  const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const [mocksResp, subjectsResp] = await Promise.all([adminApi.listMocks(), adminApi.listSubjects()]);
      setMocks(mocksResp as MockExam[]);
      setSubjects(subjectsResp as Subject[]);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load mock exam data.",
      );
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const idsKey = form.questionIds.join("|");
  useEffect(() => {
    if (!form.questionIds.length) return;
    const need = form.questionIds.filter((id) => !mcqCache.has(String(id)));
    if (!need.length) return;
    let cancelled = false;
    (async () => {
      try {
        const { items } = await adminApi.lookupMcqsByIds(need);
        if (cancelled) return;
        setMcqCache((prev) => {
          const next = new Map(prev);
          for (const m of items) {
            next.set(String(m.id), m);
          }
          return next;
        });
      } catch {
        /* toast on save instead */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by id list only
  }, [idsKey]);

  const selectedMcqsOrdered = useMemo(() => {
    return form.questionIds.map((qid) => {
      const id = String(qid);
      const found = mcqCache.get(id);
      if (found) return found;
      return {
        id,
        subjectId: "",
        subjectName: "",
        track: form.track,
        question: `Loading or unknown ID… (${id.slice(0, 12)}…)`,
        options: ["", "", "", "", ""] as [string, string, string, string, string],
        correctOption: 0,
        explanation: "",
        published: false,
      } satisfies Mcq;
    });
  }, [form.questionIds, form.track, mcqCache]);

  const toggleQuestionId = useCallback((value: string) => {
    const v = String(value);
    setForm((prev) => {
      const exists = prev.questionIds.includes(v);
      return {
        ...prev,
        questionIds: exists ? prev.questionIds.filter((item) => item !== v) : [...prev.questionIds, v],
      };
    });
  }, []);

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

  const moveQuestion = useCallback((index: number, delta: number) => {
    setForm((prev) => {
      const next = [...prev.questionIds];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      const t = next[index];
      next[index] = next[j];
      next[j] = t;
      return { ...prev, questionIds: next };
    });
  }, []);

  const clearAllQuestions = useCallback(() => {
    setForm((prev) => ({ ...prev, questionIds: [] }));
  }, []);

  const openBank = () => {
    setBankKey((k) => k + 1);
    setBankOpen(true);
  };

  const runImport = async () => {
    const ids = parseIdList(importText);
    if (!ids.length) {
      setFeedback({ type: "error", message: "Paste at least one MCQ document ID." });
      return;
    }
    setImportBusy(true);
    setFeedback(null);
    try {
      const { items } = await adminApi.lookupMcqsByIds(ids);
      if (!items.length) {
        setFeedback({
          type: "error",
          message: "No matching MCQs in Firestore for those IDs. Check the document IDs in the mcqs collection.",
        });
        return;
      }
      const found = new Set(items.map((m) => String(m.id)));
      const missing = ids.filter((id) => !found.has(id));
      setMcqCache((prev) => {
        const next = new Map(prev);
        for (const m of items) next.set(String(m.id), m);
        return next;
      });
      setForm((prev) => {
        const have = new Set(prev.questionIds.map(String));
        const appended = [...prev.questionIds];
        for (const id of ids) {
          if (!have.has(id) && found.has(id)) {
            have.add(id);
            appended.push(id);
          }
        }
        return { ...prev, questionIds: appended };
      });
      setImportOpen(false);
      setImportText("");
      const msg =
        missing.length === 0
          ? `Imported ${items.length} question(s) in list order (duplicates skipped).`
          : `Imported ${items.length} question(s). ${missing.length} ID(s) not found — not added.`;
      setFeedback({ type: "success", message: msg });
    } catch (e) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setImportBusy(false);
    }
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFeedback({ type: "error", message: "Add a mock title." });
      return;
    }
    if (!form.questionIds.length) {
      setFeedback({
        type: "error",
        message: "Add questions via the bank, or import IDs.",
      });
      return;
    }
    setSaving(true);
    const savedCount = form.questionIds.length;
    setFeedback(null);
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
      setMcqCache(new Map());
      await load("refresh");
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
    setDeletingId(mock.id);
    setFeedback(null);
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
        setMcqCache(new Map());
      }
      await load("refresh");
      setFeedback({ type: "success", message: "Mock exam deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  const onEdit = (mock: MockExam) => {
    setForm({
      id: mock.id,
      title: mock.title,
      track: mock.track === "FLK 2" ? "FLK 2" : "FLK 1",
      subjectIds: Array.isArray(mock.subjectIds) ? mock.subjectIds.map(String) : [],
      questionIds: normalizeMockQuestionIds(mock.questionIds).map(String),
      durationMinutes: mock.durationMinutes,
      examMode: mock.examMode,
      revealAnswersInPractice: mock.revealAnswersInPractice,
      published: mock.published,
    });
    setMcqCache(new Map());
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
    setMcqCache(new Map());
    setFeedback(null);
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Mock exams"
        subtitle="Build mocks from the MCQ bank without loading thousands of rows on this page. Order matters — use ↑ ↓ to reorder."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}

        {loadError && !initialLoading ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void load("initial")}
              className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Retry
            </button>
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {form.id ? "Edit mock" : "Create mock"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {initialLoading ? "Loading…" : refreshing ? "Syncing…" : `${form.questionIds.length} questions selected`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onNewMock}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                >
                  New mock
                </button>
              </div>
            </div>

            <form className="mt-4 space-y-5" onSubmit={onSave}>
              <FormSection title="Basics">
                <label className="block text-xs font-medium text-slate-600">Title</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. FLK1 Mock — Contract & Tort"
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">FLK track</label>
                    <select
                      value={form.track}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))
                      }
                      disabled={saving}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
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
                      disabled={saving}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
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
                          disabled={saving}
                        />
                        {subject.name}
                      </label>
                    ))}
                </div>
              </FormSection>

              <FormSection
                title="Questions in this mock"
                helper="Exam order matches the list. Open the bank to pick from paginated MCQs, or paste Firestore IDs."
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openBank}
                    disabled={saving || initialLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Open question bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Import IDs…
                  </button>
                  <button
                    type="button"
                    onClick={clearAllQuestions}
                    disabled={!form.questionIds.length || saving}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear all
                  </button>
                </div>

                {selectedMcqsOrdered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    No questions yet. Open the bank (search and paginate 1000+ MCQs) or import IDs from Firestore.
                  </p>
                ) : (
                  <ol className="max-h-[min(420px,55vh)] space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 text-sm">
                    {selectedMcqsOrdered.map((mcq, idx) => (
                      <li
                        key={`${mcqKey(mcq)}-${idx}`}
                        className="flex gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-2 py-2"
                      >
                        <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-xs text-slate-400">
                          {idx + 1}.
                        </span>
                        <span className="min-w-0 flex-1 text-slate-800">{mcq.question}</span>
                        <div className="flex shrink-0 flex-col gap-1">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, -1)}
                              disabled={idx === 0 || saving}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                              aria-label="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, 1)}
                              disabled={idx >= selectedMcqsOrdered.length - 1 || saving}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 disabled:opacity-40"
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuestionId(mcq.id)}
                            disabled={saving}
                            className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </FormSection>

              <FormSection title="Student experience">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.examMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, examMode: event.target.checked }))}
                    disabled={saving}
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
                    disabled={saving}
                  />
                  In practice mode, reveal answer after each question
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                    disabled={saving}
                  />
                  Published (visible on student mocks page)
                </label>
              </FormSection>

              <button
                disabled={saving || initialLoading}
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : form.id ? "Save changes" : "Create mock"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Saved mocks</h3>
            <p className="mt-1 text-sm text-slate-600">
              Question counts follow the same rules as the student app.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
              {initialLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : mocks.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No mocks yet.</p>
              ) : (
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Mock</th>
                      <th className="px-3 py-2">Info</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mocks.map((mock) => {
                      const n = normalizeMockQuestionIds(mock.questionIds).length;
                      return (
                        <tr key={mock.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-3 font-medium text-slate-900">{mock.title}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {mock.track} · {n} Q · {mock.durationMinutes} min
                            {!mock.published ? " · draft" : ""}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onEdit(mock)}
                                disabled={!!deletingId || saving}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDelete(mock)}
                                disabled={deletingId === mock.id || saving}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingId === mock.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        </section>

        {importOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={() => {
              if (!importBusy) {
                setImportOpen(false);
                setImportText("");
              }
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="import-title" className="text-lg font-semibold text-slate-900">
                Import MCQ IDs
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Paste Firestore document IDs from the <code className="rounded bg-slate-100 px-1">mcqs</code>{" "}
                collection — one per line, or comma / semicolon separated. Order is preserved; duplicates and blanks
                are skipped.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                placeholder="abc123…&#10;def456…"
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                disabled={importBusy}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(false);
                    setImportText("");
                  }}
                  disabled={importBusy}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void runImport()}
                  disabled={importBusy}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {importBusy ? "Looking up…" : "Add to mock"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {bankOpen ? (
          <McqBankDrawer
            key={bankKey}
            defaultTrack={form.track}
            subjects={subjects}
            selectedIds={selectedIdSet}
            onToggleId={toggleQuestionId}
            onClose={() => setBankOpen(false)}
          />
        ) : null}
      </AdminShell>
    </AdminGuard>
  );
}
