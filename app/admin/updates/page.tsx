"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import RichTextEditor from "@/app/components/admin/rich-text-editor";
import ToastInline from "@/app/components/admin/toast-inline";
import UpdateContent from "@/app/components/portal/update-content";
import { adminApi } from "@/lib/services/admin-api";
import { excerptFromContent } from "@/lib/services/update-content";
import { uploadPortalFile } from "@/lib/services/storage-upload";
import type { PortalUpdate } from "@/lib/types/admin";

function formatUpdatedAt(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function addPath(paths: string[], path: string) {
  if (!path || paths.includes(path)) return paths;
  return [...paths, path];
}

export default function AdminUpdatesPage() {
  const [updates, setUpdates] = useState<PortalUpdate[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [form, setForm] = useState({
    id: "",
    title: "",
    excerpt: "",
    content: "",
    coverImageUrl: "",
    coverImagePath: "",
    imagePaths: [] as string[],
    published: true,
  });

  const load = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const rows = (await adminApi.listUpdates()) as PortalUpdate[];
      setUpdates(rows);
    } catch {
      setLoadError("Could not load updates. Check your session and try again.");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(form.coverImageUrl || null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile, form.coverImageUrl]);

  const stats = useMemo(() => {
    const published = updates.filter((item) => item.published).length;
    return { total: updates.length, published, draft: updates.length - published };
  }, [updates]);

  const filteredUpdates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return updates.filter((item) => {
      if (publishedFilter === "true" && !item.published) return false;
      if (publishedFilter === "false" && item.published) return false;
      if (!q) return true;
      const excerpt = (item.excerpt || excerptFromContent(item.content)).toLowerCase();
      return item.title.toLowerCase().includes(q) || excerpt.includes(q);
    });
  }, [updates, query, publishedFilter]);

  const onCancelEdit = () => {
    setForm({
      id: "",
      title: "",
      excerpt: "",
      content: "",
      coverImageUrl: "",
      coverImagePath: "",
      imagePaths: [],
      published: true,
    });
    setCoverFile(null);
    setPreviewOpen(false);
    setFeedback(null);
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFeedback({ type: "error", message: "Title is required." });
      return;
    }
    if (!form.content.trim() || form.content === "<p></p>") {
      setFeedback({ type: "error", message: "Content is required." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      let coverImageUrl = form.coverImageUrl;
      let coverImagePath = form.coverImagePath;
      let imagePaths = [...form.imagePaths];

      if (coverFile) {
        const uploaded = await uploadPortalFile("sqe/updates", coverFile);
        coverImageUrl = uploaded.url;
        coverImagePath = uploaded.path;
        imagePaths = addPath(imagePaths, uploaded.path);
      }

      const excerpt = form.excerpt.trim() || excerptFromContent(form.content);

      await adminApi.upsertUpdate({
        id: form.id || undefined,
        title: form.title.trim(),
        excerpt,
        content: form.content,
        coverImageUrl,
        coverImagePath,
        imagePaths,
        published: form.published,
      });

      await adminApi.logAudit({
        action: form.id ? "update_portal_update" : "create_portal_update",
        entity: "portal_update",
        entityId: form.id || undefined,
        details: form.title.trim(),
      });

      onCancelEdit();
      await load("refresh");
      setFeedback({ type: "success", message: "Update saved successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (item: PortalUpdate) => {
    setForm({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt || "",
      content: item.content,
      coverImageUrl: item.coverImageUrl || "",
      coverImagePath: item.coverImagePath || "",
      imagePaths: item.imagePaths || (item.coverImagePath ? [item.coverImagePath] : []),
      published: item.published,
    });
    setCoverFile(null);
    setPreviewOpen(false);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (item: PortalUpdate) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setFeedback(null);
    try {
      await adminApi.deleteUpdate(item.id);
      await adminApi.logAudit({
        action: "delete_portal_update",
        entity: "portal_update",
        entityId: item.id,
        details: item.title,
      });
      if (form.id === item.id) onCancelEdit();
      await load("refresh");
      setFeedback({ type: "success", message: "Update deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Delete failed" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Manage Updates"
        subtitle="Publish portal announcements with formatted text, cover images, and inline photos for students."
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
                {form.id ? "Edit update" : "Create update"}
              </h3>
              <div className="flex gap-2">
                {form.content ? (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen((open) => !open)}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {previewOpen ? "Hide preview" : "Preview"}
                  </button>
                ) : null}
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
            </div>

            <form className="mt-4 space-y-5" onSubmit={onSave}>
              <FormSection title="Update details">
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Update title"
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-60"
                />
                <textarea
                  value={form.excerpt}
                  onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
                  placeholder="Optional short summary (auto-generated from content if left blank)"
                  disabled={saving}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed disabled:opacity-60"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, published: event.target.checked }))
                    }
                    disabled={saving}
                  />
                  Published — visible to students on the Updates page
                </label>
              </FormSection>

              <FormSection title="Cover image" helper="Optional hero image shown at the top of the update.">
                {coverPreviewUrl ? (
                  <div className="relative aspect-[21/9] max-h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <Image
                      src={coverPreviewUrl}
                      alt="Cover preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-60"
                />
              </FormSection>

              <FormSection title="Content" helper="Use the toolbar for headings, lists, links, and inline images.">
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                  onImageUploaded={(path) =>
                    setForm((prev) => ({ ...prev, imagePaths: addPath(prev.imagePaths, path) }))
                  }
                  disabled={saving}
                  placeholder="Write the full update here…"
                />
              </FormSection>

              {previewOpen ? (
                <FormSection title="Live preview">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    {coverPreviewUrl ? (
                      <div className="relative mb-4 aspect-[21/9] max-h-56 w-full overflow-hidden rounded-xl">
                        <Image
                          src={coverPreviewUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}
                    <h4 className="text-xl font-semibold text-slate-900">{form.title || "Untitled"}</h4>
                    <div className="mt-4">
                      <UpdateContent html={form.content} />
                    </div>
                  </div>
                </FormSection>
              ) : null}

              <button
                disabled={saving || initialLoading}
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:max-w-xs"
              >
                {saving ? "Saving…" : form.id ? "Update post" : "Publish update"}
              </button>
            </form>
          </article>

          <article className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">All updates</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {initialLoading
                    ? "Loading…"
                    : refreshing
                      ? "Refreshing…"
                      : `${filteredUpdates.length} of ${updates.length} shown`}
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
                placeholder="Search title or summary…"
                disabled={initialLoading}
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
                aria-label="Search updates"
              />
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
              ) : filteredUpdates.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-500">
                  {updates.length === 0 ? "No updates yet." : "No rows match your filters."}
                </p>
              ) : (
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Title</th>
                      <th className="hidden px-3 py-3 lg:table-cell">Summary</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Updated</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUpdates.map((item) => (
                      <tr key={item.id} className="bg-white hover:bg-slate-50/80">
                        <td className="max-w-[220px] px-3 py-3 font-medium text-slate-900">{item.title}</td>
                        <td className="hidden max-w-[280px] px-3 py-3 text-xs text-slate-500 lg:table-cell">
                          <span className="line-clamp-2">
                            {item.excerpt || excerptFromContent(item.content)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.published
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.published ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                          {formatUpdatedAt(item.updatedAt)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              disabled={saving || !!deletingId}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDelete(item)}
                              disabled={saving || deletingId === item.id}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === item.id ? "Deleting…" : "Delete"}
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
