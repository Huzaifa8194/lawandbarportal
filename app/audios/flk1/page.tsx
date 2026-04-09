"use client";

import { useState } from "react";
import PortalShell from "../../components/portal-shell";
import SubjectsList from "../../components/subjects-list";

export default function AudiosFlk1Page() {
  const [query, setQuery] = useState("");

  return (
    <PortalShell title="" subtitle="" hideHeader>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19V6l12-2v13" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 19a2 2 0 11-4 0 2 2 0 014 0zm12-2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#121f1d] sm:text-4xl">
            Audios: FLK 1
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#121f1d]/60 sm:text-base">
            Open FLK 1 subjects with audio-only learning.
          </p>
        </div>
      </header>
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700" htmlFor="audios-flk1-subject-search">
          Search FLK 1 subjects
        </label>
        <input
          id="audios-flk1-subject-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search FLK 1 subject name..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
        />
      </section>
      <SubjectsList track="FLK 1" query={query} basePath="/audios" />
    </PortalShell>
  );
}
