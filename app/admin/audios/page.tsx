"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { AudioLesson, Book, FlkTrack, Subject } from "@/lib/types/admin";

export default function AdminAudiosPage() {
  const [audios, setAudios] = useState<AudioLesson[]>([]);
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
    subjectId: "",
    subjectName: "",
    track: "FLK 1" as FlkTrack,
    bookId: "",
    durationSeconds: 0,
    published: true,
  });

  const load = async () => {
    const [audiosResp, subjectsResp, booksResp] = await Promise.all([
      adminApi.listAudios(),
      adminApi.listSubjects(),
      adminApi.listBooks(),
    ]);
    setAudios(audiosResp as AudioLesson[]);
    setSubjects(subjectsResp as Subject[]);
    setBooks(booksResp as Book[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load audio data." }));
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
        const uploaded = await uploadPortalFile("sqe/audios", selectedFile);
        fileUrl = uploaded.url;
        filePath = uploaded.path;
      } else if (!form.id) {
        setFeedback({ type: "error", message: "Please upload an audio file for new records." });
        setSaving(false);
        return;
      }

      await adminApi.upsertAudio({
        ...form,
        bookId: form.bookId || undefined,
        durationSeconds: form.durationSeconds || undefined,
        fileUrl: fileUrl || audios.find((item) => item.id === form.id)?.fileUrl || "",
        filePath: filePath || audios.find((item) => item.id === form.id)?.filePath || "",
      });
      await adminApi.logAudit({
        action: form.id ? "update_audio" : "create_audio",
        entity: "audio",
        entityId: form.id || undefined,
        details: form.title,
      });
      setForm({
        id: "",
        title: "",
        subjectId: "",
        subjectName: "",
        track: "FLK 1",
        bookId: "",
        durationSeconds: 0,
        published: true,
      });
      setSelectedFile(null);
      await load();
      setFeedback({ type: "success", message: "Audio saved successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (audio: AudioLesson) => {
    setForm({
      id: audio.id,
      title: audio.title,
      subjectId: audio.subjectId,
      subjectName: audio.subjectName,
      track: audio.track,
      bookId: audio.bookId || "",
      durationSeconds: audio.durationSeconds || 0,
      published: audio.published,
    });
    setFeedback(null);
  };

  const onDelete = async (audio: AudioLesson) => {
    if (!confirm(`Delete "${audio.title}"?`)) return;
    try {
      await adminApi.deleteAudio(audio.id);
      await adminApi.logAudit({ action: "delete_audio", entity: "audio", entityId: audio.id, details: audio.title });
      await load();
      setFeedback({ type: "success", message: "Audio deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Audio Lessons Management"
        subtitle="Assign each audio lesson to the correct FLK and subject, with optional book linkage."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit Audio" : "Add New Audio"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <FormSection title="Audio details">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Audio title"
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

              <FormSection title="Audio upload">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <button
                disabled={saving}
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Update audio" : "Create audio"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Existing Audio Lessons</h3>
            <div className="mt-4 space-y-3">
              {audios.map((audio) => (
                <div key={audio.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium">{audio.title}</p>
                  <p className="text-sm text-slate-600">
                    {audio.track} • {audio.subjectName}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEdit(audio)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(audio)}
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
