"use client";

import Link from "next/link";
import { useState } from "react";
import PortalShell from "../components/portal-shell";
import SubjectsList from "../components/subjects-list";

export default function AudiosPage() {
  const [query, setQuery] = useState("");

  return (
    <PortalShell
      title="Audios"
      subtitle="Choose FLK 1 or FLK 2, browse subjects, and open audio-only learning access."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Track</p>
          <h3 className="mt-1 text-lg font-semibold">FLK 1</h3>
          <p className="mt-2 text-sm text-slate-600">Open FLK 1 subjects with audio-only access.</p>
          <Link
            href="/audios/flk1"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open FLK 1
          </Link>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Track</p>
          <h3 className="mt-1 text-lg font-semibold">FLK 2</h3>
          <p className="mt-2 text-sm text-slate-600">Open FLK 2 subjects with audio-only access.</p>
          <Link
            href="/audios/flk2"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open FLK 2
          </Link>
        </article>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-slate-700" htmlFor="audios-search">
            Search subjects
          </label>
          <input
            id="audios-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by subject name..."
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
          />
        </div>
        <h3 className="text-lg font-semibold">FLK 1 Subjects</h3>
        <SubjectsList track="FLK 1" query={query} basePath="/audios" />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">FLK 2 Subjects</h3>
        <SubjectsList track="FLK 2" query={query} basePath="/audios" />
      </section>
    </PortalShell>
  );
}
