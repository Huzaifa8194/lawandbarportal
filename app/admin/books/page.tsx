"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { Book, FlkTrack, Subject } from "@/lib/types/admin";

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
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

  const load = async () => {
    const [booksResp, subjectsResp] = await Promise.all([
      adminApi.listBooks(),
      adminApi.listSubjects(),
    ]);
    setBooks(booksResp as Book[]);
    setSubjects(subjectsResp as Subject[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load books." }));
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
      await load();
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
    setFeedback(null);
  };

  const onDelete = async (book: Book) => {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteBook(book.id);
      await adminApi.logAudit({ action: "delete_book", entity: "book", entityId: book.id, details: book.title });
      await load();
      setFeedback({ type: "success", message: "Book deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Books Management"
        subtitle="Upload and organize SQE PDFs by FLK and subject with a clear, non-technical workflow."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{form.id ? "Edit Book" : "Add New Book"}</h3>
            <form className="mt-4 space-y-3" onSubmit={onSave}>
              <FormSection title="Book details" helper="Keep titles clear and easy for students.">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Book title"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Optional short description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <FormSection title="Classification" helper="Every book must be assigned to FLK and subject.">
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
                      {subject.name} ({subject.track})
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
                  />
                  Published (visible to students)
                </label>
              </FormSection>

              <FormSection
                title="PDF upload"
                helper="For edit, upload a file only when replacing the current PDF."
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </FormSection>

              <button
                disabled={saving}
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : form.id ? "Update book" : "Create book"}
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Existing Books</h3>
            <div className="mt-4 space-y-3">
              {books.map((book) => (
                <div key={book.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-medium">{book.title}</p>
                  <p className="text-sm text-slate-600">
                    {book.track} • {book.subjectName}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEdit(book)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(book)}
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
