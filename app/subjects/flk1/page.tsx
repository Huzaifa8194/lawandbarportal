"use client";

import PortalShell from "../../components/portal-shell";
import SubjectsList from "../../components/subjects-list";

export default function Flk1SubjectsPage() {
  return (
    <PortalShell title="" subtitle="" hideHeader>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#121f1d] sm:text-4xl">
            FLK 1
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#121f1d]/60 sm:text-base">
            Functioning Legal Knowledge 1 — Select a subject to study.
          </p>
        </div>
      </header>
      <SubjectsList track="FLK 1" />
    </PortalShell>
  );
}
