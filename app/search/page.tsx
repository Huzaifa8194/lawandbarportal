"use client";

import Link from "next/link";
import PortalShell from "../components/portal-shell";

export default function SearchPage() {
  return (
    <PortalShell
      title="Search moved into each page"
      subtitle="Use the built-in search bars on dashboard, subjects, mocks, progress, and subject workspace pages."
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-700">
          Search is now distributed directly into each student page so results are scoped to what you are
          working on.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Dashboard
          </Link>
          <Link href="/subjects" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800">
            Subjects
          </Link>
          <Link href="/mocks" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800">
            Mocks
          </Link>
          <Link href="/progress" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800">
            Progress
          </Link>
        </div>
      </section>
    </PortalShell>
  );
}
