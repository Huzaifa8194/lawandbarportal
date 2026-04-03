"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { Book, FlkTrack, Subject, VideoLesson } from "@/lib/types/admin";

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const load = async () => {
    const [videosResp, subjectsResp, booksResp] = await Promise.all([
      adminApi.listVideos(),
      adminApi.listSubjects(),
      adminApi.listBooks(),
    ]);
    setVideos(videosResp as VideoLesson[]);
    setSubjects(subjectsResp as Subject[]);
    setBooks(booksResp as Book[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load video data." }));
  }, []);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.subjectId) {
      setFeedback({ type: "error", message: "Title and subject are required." });
      return;
    }
    setSaving(true);
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
      await load();
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
    setFeedback(null);
  };

  const onDelete = async (video: VideoLesson) => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    try {
      await adminApi.deleteVideo(video.id);
      await adminApi.logAudit({ action: "delete_video", entity: "video", entityId: video.id, details: video.title });
      await load();
      setFeedback({ type: "success", message: "Video deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Video Lessons Management"
        subtitle="Upload and publish subject videos so students can learn in multiple formats."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit Video" : "Add New Video"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <FormSection title="Video details">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Video title"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={form.durationSeconds}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, durationSeconds: Number(event.target.value) }))
                  }
                  placeholder="Duration in seconds (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <FormSection title="Classification and linking">
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
                <select
                  value={form.bookId}
                  onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                  />
                  Published
                </label>
              </FormSection>

              <FormSection title="Video upload">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <button
                disabled={saving}
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Update video" : "Create video"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Existing Videos</h3>
            <div className="mt-4 space-y-3">
              {videos.map((video) => (
                <div key={video.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium">{video.title}</p>
                  <p className="text-sm text-slate-600">
                    {video.track} • {video.subjectName}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEdit(video)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(video)}
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
