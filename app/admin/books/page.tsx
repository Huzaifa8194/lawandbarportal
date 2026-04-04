"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { Book, FlkTrack, Subject } from "@/lib/types/admin";

function formatUpdatedAt(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function BooksTableSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4"
        >
          <div className="h-4 min-w-[40%] flex-1 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-8 w-28 rounded-lg bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<"all" | FlkTrack>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    subjectId: "",
    subjectName: "",
    track: "FLK 1" as FlkTrack,
    published: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const [booksResp, subjectsResp] = await Promise.all([
        adminApi.listBooks(),
        adminApi.listSubjects(),
      ]);
      setBooks(booksResp as Book[]);
      setSubjects(subjectsResp as Subject[]);
    } catch {
      setLoadError("Could not load books. Check your connection and admin session, then retry.");
    } finally {
      if (mode === "initial") setInitialLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const stats = useMemo(() => {
    const published = books.filter((b) => b.published).length;
    return {
      total: books.length,
      published,
      draft: books.length - published,
    };
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((book) => {
      if (trackFilter !== "all" && book.track !== trackFilter) return false;
      if (statusFilter === "published" && !book.published) return false;
      if (statusFilter === "draft" && book.published) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        book.subjectName.toLowerCase().includes(q) ||
        book.description?.toLowerCase().includes(q)
      );
    });
  }, [books, query, trackFilter, statusFilter]);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.subjectId) {
      setFeedback({ type: "error", message: "Title and subject are required." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      let fileUrl = "";
      let filePath = "";
      if (selectedFile) {
        const uploaded = await uploadPortalFile("sqe/books", selectedFile);
        fileUrl = uploaded.url;
        filePath = uploaded.path;
      } else if (!form.id) {
        setFeedback({ type: "error", message: "Please upload a PDF file for new books." });
        setSaving(false);
        return;
      }

      await adminApi.upsertBook({
        ...form,
        fileUrl: fileUrl || books.find((item) => item.id === form.id)?.fileUrl || "",
        filePath: filePath || books.find((item) => item.id === form.id)?.filePath || "",
      });
      await adminApi.logAudit({
        action: form.id ? "update_book" : "create_book",
        entity: "book",
        entityId: form.id || undefined,
        details: form.title,
      });

      setForm({
        id: "",
        title: "",
        description: "",
        subjectId: "",
        subjectName: "",
        track: "FLK 1",
        published: true,
      });
      setSelectedFile(null);
      await load("refresh");
      setFeedback({ type: "success", message: "Book saved successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (book: Book) => {
    setForm({
      id: book.id,
      title: book.title,
      description: book.description || "",
      subjectId: book.subjectId,
      subjectName: book.subjectName,
      track: book.track,
      published: book.published,
    });
    setSelectedFile(null);
    setFeedback(null);
  };

  const onCancelEdit = () => {
    setForm({
      id: "",
      title: "",
      description: "",
      subjectId: "",
      subjectName: "",
      track: "FLK 1",
      published: true,
    });
    setSelectedFile(null);
    setFeedback(null);
  };

  const onDelete = async (book: Book) => {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    setDeletingId(book.id);
    setFeedback(null);
    try {
      await adminApi.deleteBook(book.id);
      await adminApi.logAudit({
        action: "delete_book",
        entity: "book",
        entityId: book.id,
        details: book.title,
      });
      if (form.id === book.id) onCancelEdit();
      await load("refresh");
      setFeedback({ type: "success", message: "Book deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  const isBusy = initialLoading || refreshing;

  return (
    <AdminGuard>
      <AdminShell
        title="Books"
        subtitle="Portal-only library in Firestore collection “portal_books”—isolated from the public site “books” collection."
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

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {initialLoading ? "—" : stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
              {initialLoading ? "—" : stats.published}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-600">
              {initialLoading ? "—" : stats.draft}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
          <article className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {form.id ? "Edit book" : "Add book"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Metadata lives in Firestore <code className="rounded bg-slate-100 px-1">portal_books</code>; PDF
                  files use Storage path <code className="rounded bg-slate-100 px-1">sqe/books</code>.
                </p>
              </div>
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

            <form className="mt-4 space-y-4" onSubmit={onSave}>
              <FormSection title="Book details" helper="Keep titles clear and easy for students.">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Book title"
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                />
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Optional short description"
                  disabled={saving}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                />
              </FormSection>

              <FormSection title="Classification" helper="Every book must be assigned to FLK and subject.">
                <select
                  value={form.track}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, track: event.target.value as FlkTrack }))
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
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
                  disabled={saving || !subjects.length}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">{subjects.length ? "Select subject" : "Loading subjects…"}</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.track})
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
                  Published (visible to students)
                </label>
              </FormSection>

              <FormSection
                title="PDF upload"
                helper="For edits, upload only when replacing the stored PDF."
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-60"
                />
              </FormSection>

              <button
                disabled={saving || initialLoading}
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : form.id ? "Update book" : "Create book"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Library</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {initialLoading
                    ? "Loading…"
                    : `${filteredBooks.length} of ${books.length} shown`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void load("refresh")}
                  disabled={isBusy}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, subject, description…"
                disabled={initialLoading}
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                aria-label="Search books"
              />
              <select
                value={trackFilter}
                onChange={(event) => setTrackFilter(event.target.value as typeof trackFilter)}
                disabled={initialLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="all">All tracks</option>
                <option value="FLK 1">FLK 1</option>
                <option value="FLK 2">FLK 2</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                disabled={initialLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div className="mt-5">
              {initialLoading ? (
                <BooksTableSkeleton />
              ) : filteredBooks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {books.length === 0
                      ? "No books in portal_books yet."
                      : "No books match your filters."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {books.length === 0
                      ? "Create a book with the form on the left, or migrate records from the legacy collection in Firebase."
                      : "Try clearing search or changing track / status filters."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Track</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Updated</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBooks.map((book) => (
                        <tr key={book.id} className="bg-white hover:bg-slate-50/80">
                          <td className="max-w-[220px] px-4 py-3">
                            <p className="font-medium text-slate-900">{book.title}</p>
                            {book.description ? (
                              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{book.description}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{book.subjectName}</td>
                          <td className="px-4 py-3 text-slate-600">{book.track}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                book.published
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {book.published ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {formatUpdatedAt(book.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onEdit(book)}
                                disabled={saving || !!deletingId}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDelete(book)}
                                disabled={saving || deletingId === book.id}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingId === book.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
