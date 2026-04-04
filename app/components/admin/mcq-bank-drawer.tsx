"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "@/lib/services/admin-api";
import type { FlkTrack, Mcq, Subject } from "@/lib/types/admin";

const PAGE_SIZE = 50;

function mcqKey(mcq: Mcq) {
  return String(mcq.id);
}

type McqBankDrawerProps = {
  onClose: () => void;
  subjects: Subject[];
  /** Default FLK filter (e.g. mock track). Remount the drawer when reopening for a clean state. */
  defaultTrack: FlkTrack;
  selectedIds: ReadonlySet<string>;
  onToggleId: (id: string) => void;
};

export default function McqBankDrawer({
  onClose,
  subjects,
  defaultTrack,
  selectedIds,
  onToggleId,
}: McqBankDrawerProps) {
  const [items, setItems] = useState<Mcq[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [mode, setMode] = useState<"page" | "search">("page");
  const [totalMatched, setTotalMatched] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<"" | FlkTrack>(() => defaultTrack);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const isSearch = debouncedSearch.length >= 2;

  const queryParams = useMemo(() => {
    const track = trackFilter || undefined;
    const subjectId = subjectFilter || undefined;
    const published = publishedFilter || undefined;
    return { track, subjectId, published };
  }, [trackFilter, subjectFilter, publishedFilter]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSearch) {
        const res = await adminApi.listMcqs({
          limit: PAGE_SIZE,
          q: debouncedSearch,
          track: queryParams.track,
          subjectId: queryParams.subjectId,
          published: queryParams.published as "true" | "false" | undefined,
        });
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setMode(res.mode);
        setTotalMatched(res.totalMatched);
      } else {
        const res = await adminApi.listMcqs({
          limit: PAGE_SIZE,
          track: queryParams.track,
          subjectId: queryParams.subjectId,
          published: queryParams.published as "true" | "false" | undefined,
        });
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setMode(res.mode);
        setTotalMatched(undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load MCQs");
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isSearch, queryParams.subjectId, queryParams.published, queryParams.track]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isSearch || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await adminApi.listMcqs({
        limit: PAGE_SIZE,
        cursor: nextCursor,
        track: queryParams.track,
        subjectId: queryParams.subjectId,
        published: queryParams.published as "true" | "false" | undefined,
      });
      setItems((prev) => {
        const seen = new Set(prev.map(mcqKey));
        const merged = [...prev];
        for (const row of res.items) {
          const k = mcqKey(row);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(row);
          }
        }
        return merged;
      });
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, isSearch, loadingMore, queryParams.subjectId, queryParams.published, queryParams.track]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pageSelectedCount = useMemo(() => items.filter((m) => selectedIds.has(mcqKey(m))).length, [items, selectedIds]);

  const toggleAllOnPage = useCallback(() => {
    const allSelected = pageSelectedCount === items.length && items.length > 0;
    for (const m of items) {
      const id = mcqKey(m);
      const isSel = selectedIds.has(id);
      if (allSelected) {
        if (isSel) onToggleId(id);
      } else if (!isSel) {
        onToggleId(id);
      }
    }
  }, [items, pageSelectedCount, selectedIds, onToggleId]);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = pageSelectedCount > 0 && pageSelectedCount < items.length;
  }, [pageSelectedCount, items.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcq-drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl sm:rounded-l-2xl sm:rounded-r-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 id="mcq-drawer-title" className="text-lg font-semibold text-slate-900">
              Question bank
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Page through or search (type 2+ characters). Tick rows to add or remove from this mock.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="shrink-0 space-y-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search question text (min. 2 characters)…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Search MCQs"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value as "" | FlkTrack)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All tracks</option>
              <option value="FLK 1">FLK 1</option>
              <option value="FLK 2">FLK 2</option>
            </select>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All statuses</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              {loading
                ? "Loading…"
                : isSearch
                  ? mode === "search" && totalMatched != null
                    ? `Found ${totalMatched} match${totalMatched === 1 ? "" : "es"} (showing first ${items.length})`
                    : `${items.length} result(s)`
                  : `${items.length} loaded${hasMore ? " · more available" : ""}`}
            </span>
            <button
              type="button"
              onClick={() => void loadFirst()}
              disabled={loading}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Apply filters
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-5">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 sm:px-4">
          {loading && !items.length ? (
            <div className="space-y-2 p-2" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No MCQs match these filters.</p>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-2 py-2">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={pageSelectedCount > 0 && pageSelectedCount === items.length}
                      onChange={toggleAllOnPage}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className="px-2 py-2">Question</th>
                  <th className="hidden w-32 px-2 py-2 sm:table-cell">Subject</th>
                  <th className="w-20 px-2 py-2">Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((mcq) => {
                  const id = mcqKey(mcq);
                  return (
                    <tr key={id} className="hover:bg-slate-50/80">
                      <td className="px-2 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => onToggleId(id)}
                          aria-label={`Select ${id}`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top text-slate-800">
                        <span className="line-clamp-3">{mcq.question}</span>
                      </td>
                      <td className="hidden px-2 py-2 align-top text-xs text-slate-600 sm:table-cell">
                        {mcq.subjectName}
                      </td>
                      <td className="px-2 py-2 align-top text-xs text-slate-600">{mcq.track}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-500">
            {selectedIds.size} question{selectedIds.size === 1 ? "" : "s"} in mock total
          </p>
          <div className="flex gap-2">
            {!isSearch && hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore || loading}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
