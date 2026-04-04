"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { FlkTrack, Mcq, Subject } from "@/lib/types/admin";

const PAGE_SIZE = 40;
const emptyOptions = ["", "", "", "", ""];

function formatUpdatedAt(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export default function AdminMcqsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<Mcq[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listMode, setListMode] = useState<"page" | "search">("page");
  const [totalMatched, setTotalMatched] = useState<number | undefined>(undefined);

  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<"" | FlkTrack>("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const isSearch = debouncedSearch.length >= 2;

  const filterParams = useMemo(
    () => ({
      track: trackFilter || undefined,
      subjectId: subjectFilter || undefined,
      published: (publishedFilter || undefined) as "true" | "false" | undefined,
    }),
    [trackFilter, subjectFilter, publishedFilter],
  );

  const loadSubjects = useCallback(async () => {
    const subjectsResp = await adminApi.listSubjects();
    setSubjects(subjectsResp as Subject[]);
  }, []);

  const loadFirstPage = useCallback(async () => {
    setListLoading(true);
    setLoadError(null);
    try {
      if (isSearch) {
        const res = await adminApi.listMcqs({
          limit: PAGE_SIZE,
          q: debouncedSearch,
          ...filterParams,
        });
        setRows(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setListMode(res.mode);
        setTotalMatched(res.totalMatched);
      } else {
        const res = await adminApi.listMcqs({
          limit: PAGE_SIZE,
          ...filterParams,
        });
        setRows(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setListMode(res.mode);
        setTotalMatched(undefined);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load MCQs");
      setRows([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setListLoading(false);
      setInitialLoading(false);
    }
  }, [debouncedSearch, isSearch, filterParams]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isSearch || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await adminApi.listMcqs({
        limit: PAGE_SIZE,
        cursor: nextCursor,
        ...filterParams,
      });
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const row of res.items) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged;
      });
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, isSearch, loadingMore, filterParams]);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.question || !form.subjectId || form.options.some((item) => !item.trim())) {
      setFeedback({ type: "error", message: "Question, subject, and all 5 options are required." });
      return;
    }
    setSaving(true);
    setFeedback(null);
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
      await loadFirstPage();
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

  const onCancelEdit = () => {
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
    setFeedback(null);
  };

  const onDelete = async (mcq: Mcq) => {
    if (!confirm("Delete this MCQ?")) return;
    setDeletingId(mcq.id);
    setFeedback(null);
    try {
      await adminApi.deleteMcq(mcq.id);
      await adminApi.logAudit({ action: "delete_mcq", entity: "mcq", entityId: mcq.id });
      if (form.id === mcq.id) onCancelEdit();
      await loadFirstPage();
      setFeedback({ type: "success", message: "MCQ deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  const listHint = useMemo(() => {
    if (initialLoading) return "Loading…";
    if (isSearch && listMode === "search" && totalMatched != null) {
      return `${totalMatched} match${totalMatched === 1 ? "" : "es"} · showing ${rows.length}`;
    }
    if (!isSearch && hasMore) return `${rows.length} loaded · more available`;
    return `${rows.length} shown`;
  }, [initialLoading, isSearch, listMode, totalMatched, rows.length, hasMore]);

  return (
    <AdminGuard>
      <AdminShell
        title="MCQ bank"
        subtitle="Paginated authoring for large banks (1000+). Use search for full-text filter; browsing uses Firestore cursors."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}

        {loadError ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="min-w-0 flex-1">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadFirstPage()}
              className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Retry
            </button>
          </div>
        ) : null}

        <section className="flex min-w-0 flex-col gap-8">
          <article className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{form.id ? "Edit MCQ" : "Add MCQ"}</h3>
              {form.id ? (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <form className="mt-4 space-y-5" onSubmit={onSave}>
              <FormSection title="Question setup">
                <textarea
                  value={form.question}
                  onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                  placeholder="Scenario / question"
                  disabled={saving}
                  rows={8}
                  className="min-h-[11rem] w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed disabled:opacity-60"
                />
                <textarea
                  value={form.explanation}
                  onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
                  placeholder="Explanation"
                  disabled={saving}
                  rows={6}
                  className="min-h-[8rem] w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed disabled:opacity-60"
                />
              </FormSection>

              <FormSection title="Classification">
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <select
                    value={form.track}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
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
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">{subjects.length ? "Select subject" : "Loading subjects…"}</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              </FormSection>

              <FormSection title="Options (exactly five)">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      disabled={saving}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
                    />
                  ))}
                </div>
                <select
                  value={form.correctOption}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, correctOption: Number(event.target.value) }))
                  }
                  disabled={saving}
                  className="mt-3 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
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
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, published: event.target.checked }))
                    }
                    disabled={saving}
                  />
                  Published
                </label>
              </FormSection>
              <button
                disabled={saving}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                type="submit"
              >
                {saving ? "Saving…" : form.id ? "Update MCQ" : "Create MCQ"}
              </button>
            </form>
          </article>

          <article className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Question bank</h3>
                <p className="mt-0.5 text-xs text-slate-500">{listHint}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadFirstPage()}
                disabled={listLoading}
                className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {listLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search (type 2+ characters)…"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Search MCQs"
              />
              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value as "" | FlkTrack)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All tracks</option>
                <option value="FLK 1">FLK 1</option>
                <option value="FLK 2">FLK 2</option>
              </select>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={publishedFilter}
                onChange={(e) => setPublishedFilter(e.target.value as "" | "true" | "false")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Search scans the full bank on the server (fine for thousands of docs, admin-only). Browse mode uses
              pagination — combine filters with Firestore indexes if prompted.
            </p>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
              {initialLoading || (listLoading && !rows.length) ? (
                <div className="p-4">
                  <TableSkeleton />
                </div>
              ) : rows.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-500">No MCQs match these filters.</p>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Question</th>
                      <th className="hidden px-3 py-3 md:table-cell">Subject</th>
                      <th className="px-3 py-3">Track</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Updated</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((mcq) => (
                      <tr key={mcq.id} className="bg-white hover:bg-slate-50/80">
                        <td className="max-w-md px-3 py-3">
                          <p className="line-clamp-2 font-medium text-slate-900">{mcq.question}</p>
                        </td>
                        <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{mcq.subjectName}</td>
                        <td className="px-3 py-3 text-slate-600">{mcq.track}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              mcq.published ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {mcq.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {formatUpdatedAt(mcq.updatedAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(mcq)}
                              disabled={saving || !!deletingId}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(mcq)}
                              disabled={saving || deletingId === mcq.id}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === mcq.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!isSearch && hasMore ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore || listLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
