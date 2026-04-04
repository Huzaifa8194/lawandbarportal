"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { Book, FlkTrack, Subject, VideoLesson } from "@/lib/types/admin";

function formatUpdatedAt(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(sec: number | undefined) {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<"" | FlkTrack>("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");

  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    subjectId: "",
    subjectName: "",
    track: "FLK 1" as FlkTrack,
    bookId: "",
    durationSeconds: 0,
    published: true,
  });

  const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const [videosResp, subjectsResp, booksResp] = await Promise.all([
        adminApi.listVideos(),
        adminApi.listSubjects(),
        adminApi.listBooks(),
      ]);
      setVideos(videosResp as VideoLesson[]);
      setSubjects(subjectsResp as Subject[]);
      setBooks(booksResp as Book[]);
    } catch {
      setLoadError("Could not load video library. Check your session and try again.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const stats = useMemo(() => {
    const published = videos.filter((v) => v.published).length;
    return { total: videos.length, published, draft: videos.length - published };
  }, [videos]);

  const bookTitle = useCallback(
    (bookId: string | undefined) => {
      if (!bookId) return "—";
      return books.find((b) => b.id === bookId)?.title ?? "—";
    },
    [books],
  );

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((video) => {
      if (trackFilter && video.track !== trackFilter) return false;
      if (subjectFilter && video.subjectId !== subjectFilter) return false;
      if (publishedFilter === "true" && !video.published) return false;
      if (publishedFilter === "false" && video.published) return false;
      if (!q) return true;
      const desc = (video.description || "").toLowerCase();
      return (
        video.title.toLowerCase().includes(q) ||
        video.subjectName.toLowerCase().includes(q) ||
        desc.includes(q)
      );
    });
  }, [videos, query, trackFilter, subjectFilter, publishedFilter]);

  const onCancelEdit = () => {
    setForm({
      id: "",
      title: "",
      description: "",
      subjectId: "",
      subjectName: "",
      track: "FLK 1",
      bookId: "",
      durationSeconds: 0,
      published: true,
    });
    setSelectedFile(null);
    setFeedback(null);
  };

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
        const uploaded = await uploadPortalFile("sqe/videos", selectedFile);
        fileUrl = uploaded.url;
        filePath = uploaded.path;
      } else if (!form.id) {
        setFeedback({ type: "error", message: "Please upload a video file for new records." });
        setSaving(false);
        return;
      }

      await adminApi.upsertVideo({
        ...form,
        bookId: form.bookId || undefined,
        durationSeconds: form.durationSeconds || undefined,
        fileUrl: fileUrl || videos.find((item) => item.id === form.id)?.fileUrl || "",
        filePath: filePath || videos.find((item) => item.id === form.id)?.filePath || "",
      });
      await adminApi.logAudit({
        action: form.id ? "update_video" : "create_video",
        entity: "video",
        entityId: form.id || undefined,
        details: form.title,
      });
      onCancelEdit();
      await load("refresh");
      setFeedback({ type: "success", message: "Video saved successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (video: VideoLesson) => {
    setForm({
      id: video.id,
      title: video.title,
      description: video.description || "",
      subjectId: video.subjectId,
      subjectName: video.subjectName,
      track: video.track,
      bookId: video.bookId || "",
      durationSeconds: video.durationSeconds || 0,
      published: video.published,
    });
    setSelectedFile(null);
    setFeedback(null);
  };

  const onDelete = async (video: VideoLesson) => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    setDeletingId(video.id);
    setFeedback(null);
    try {
      await adminApi.deleteVideo(video.id);
      await adminApi.logAudit({
        action: "delete_video",
        entity: "video",
        entityId: video.id,
        details: video.title,
      });
      if (form.id === video.id) onCancelEdit();
      await load("refresh");
      setFeedback({ type: "success", message: "Video deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Video lessons"
        subtitle="Upload FLK videos by subject. Optional book links tie lessons to portal PDFs."
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

        <section className="flex min-w-0 flex-col gap-8">
          <article className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                {form.id ? "Edit video" : "Add video"}
              </h3>
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
              <FormSection title="Video details">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Video title"
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-60"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional description"
                  disabled={saving}
                  rows={5}
                  className="min-h-[7rem] w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed disabled:opacity-60"
                />
                <input
                  type="number"
                  min={0}
                  value={form.durationSeconds || ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, durationSeconds: Number(event.target.value) }))
                  }
                  placeholder="Duration in seconds (optional)"
                  disabled={saving}
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-60"
                />
              </FormSection>

              <FormSection title="Classification and linking">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
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
                        bookId: "",
                      }));
                    }}
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">{subjects.length ? "Select subject" : "Loading…"}</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.bookId}
                    onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
                    disabled={saving || !form.subjectId}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">Optional: link to book</option>
                    {books
                      .filter((item) => item.subjectId === form.subjectId)
                      .map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                  </select>
                </div>
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

              <FormSection title="Video upload" helper="When editing, upload only if replacing the file.">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-60"
                />
              </FormSection>

              <button
                disabled={saving || initialLoading}
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:max-w-xs"
              >
                {saving ? "Saving…" : form.id ? "Update video" : "Create video"}
              </button>
            </form>
          </article>

          <article className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Library</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {initialLoading
                    ? "Loading…"
                    : refreshing
                      ? "Refreshing…"
                      : `${filteredVideos.length} of ${videos.length} shown`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load("refresh")}
                disabled={refreshing || initialLoading}
                className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, subject, description…"
                disabled={initialLoading}
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                aria-label="Search videos"
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
                className="min-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
              {initialLoading ? (
                <TableSkeleton />
              ) : filteredVideos.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-500">
                  {videos.length === 0 ? "No videos yet." : "No rows match your filters."}
                </p>
              ) : (
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Title</th>
                      <th className="hidden px-3 py-3 lg:table-cell">Description</th>
                      <th className="hidden px-3 py-3 md:table-cell">Subject</th>
                      <th className="px-3 py-3">Track</th>
                      <th className="hidden px-3 py-3 xl:table-cell">Book</th>
                      <th className="px-3 py-3">Duration</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Updated</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVideos.map((video) => (
                      <tr key={video.id} className="bg-white hover:bg-slate-50/80">
                        <td className="max-w-[200px] px-3 py-3 font-medium text-slate-900">{video.title}</td>
                        <td className="hidden max-w-[200px] px-3 py-3 text-xs text-slate-500 lg:table-cell">
                          <span className="line-clamp-2">{video.description || "—"}</span>
                        </td>
                        <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{video.subjectName}</td>
                        <td className="px-3 py-3 text-slate-600">{video.track}</td>
                        <td className="hidden max-w-[140px] truncate px-3 py-3 text-xs text-slate-500 xl:table-cell">
                          {bookTitle(video.bookId)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {formatDuration(video.durationSeconds)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              video.published
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {video.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {formatUpdatedAt(video.updatedAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(video)}
                              disabled={saving || !!deletingId}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(video)}
                              disabled={saving || deletingId === video.id}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === video.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
