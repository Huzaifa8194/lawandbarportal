"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import PortalShell from "../components/portal-shell";
import UpdateContent from "../components/portal/update-content";
import { listUpdates } from "@/lib/repositories/portal-repository";
import { excerptFromContent } from "@/lib/services/update-content";
import type { PortalUpdate } from "@/lib/types/admin";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<PortalUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listUpdates();
        if (!active) return;
        setUpdates(rows.filter((item) => item.published));
      } catch {
        if (active) setError("Could not load updates. Please refresh and try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return updates;
    return updates.filter((item) => {
      const excerpt = (item.excerpt || excerptFromContent(item.content)).toLowerCase();
      return item.title.toLowerCase().includes(q) || excerpt.includes(q);
    });
  }, [updates, query]);

  return (
    <PortalShell
      title="Updates"
      subtitle="Latest announcements, study tips, and portal news from the Law & Bar team."
    >
      <section className="rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-[#121f1d]/60">
              {loading ? "Loading updates…" : `${filtered.length} update${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search updates…"
            disabled={loading}
            className="w-full rounded-xl border border-[#121f1d]/15 px-4 py-2.5 text-sm disabled:opacity-60 sm:max-w-xs"
            aria-label="Search updates"
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-[#121f1d]/8" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#121f1d]/15 bg-white px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#121f1d]">
            No updates yet
          </p>
          <p className="mt-2 text-sm text-[#121f1d]/60">
            {query ? "Try a different search term." : "Check back soon for announcements and study news."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filtered.map((item) => {
            const expanded = expandedId === item.id;
            const summary = item.excerpt || excerptFromContent(item.content, 220);
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-[#121f1d]/8 bg-white shadow-sm transition hover:shadow-md"
              >
                {item.coverImageUrl ? (
                  <div className="relative aspect-[21/9] max-h-64 w-full bg-[#121f1d]/5">
                    <Image
                      src={item.coverImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 900px"
                      unoptimized
                    />
                  </div>
                ) : null}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#121f1d]/50">
                    <time dateTime={item.updatedAt || item.createdAt}>
                      {formatDate(item.updatedAt || item.createdAt)}
                    </time>
                  </div>
                  <h2 className="mt-2 font-[family-name:var(--font-playfair)] text-xl font-semibold tracking-tight text-[#121f1d] sm:text-2xl">
                    {item.title}
                  </h2>
                  {!expanded ? (
                    <p className="mt-3 text-sm leading-relaxed text-[#121f1d]/70">{summary}</p>
                  ) : (
                    <div className="mt-4">
                      <UpdateContent html={item.content} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[#26d9c0]/15 px-3 py-1.5 text-sm font-medium text-[#0d7a6c] transition hover:bg-[#26d9c0]/25"
                  >
                    {expanded ? "Show less" : "Read full update"}
                    <svg
                      className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
