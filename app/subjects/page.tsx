"use client";

import Link from "next/link";
import PortalShell from "../components/portal-shell";
import SubjectsList from "../components/subjects-list";

export default function SubjectsPage() {
  return (
    <PortalShell
      title="FLK Subjects"
      subtitle="Choose a track to open only FLK 1 or FLK 2 subjects."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Track</p>
          <h3 className="mt-1 text-lg font-semibold">FLK1</h3>
          <p className="mt-2 text-sm text-slate-600">
            Open only FLK 1 subjects and related learning resources.
          </p>
          <Link
            href="/subjects/flk1"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open FLK1
          </Link>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Track</p>
          <h3 className="mt-1 text-lg font-semibold">FLK2</h3>
          <p className="mt-2 text-sm text-slate-600">
            Open only FLK 2 subjects and related learning resources.
          </p>
          <Link
            href="/subjects/flk2"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open FLK2
          </Link>
        </article>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">FLK1 Subjects</h3>
        <SubjectsList track="FLK 1" />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">FLK2 Subjects</h3>
        <SubjectsList track="FLK 2" />
      </section>
    </PortalShell>
  );
}
