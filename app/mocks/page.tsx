"use client";

import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";
import Link from "next/link";

const practiceFlow = [
  "One question at a time",
  "Immediate answer and explanation",
  "Navigate next/previous",
];

const examFlow = [
  "Full paper with timer",
  "No answers until submission",
  "Final score and answer review",
];

export default function MocksPage() {
  const { mocks, loading } = usePortalLiveData();

  return (
    <PortalShell
      title="Mock Exams & MCQs"
      subtitle="Students can switch between practice mode and full exam mode with tracked scores and review."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Practice Mode</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {practiceFlow.map((item) => (
              <li key={item} className="rounded-lg border border-slate-200 p-3">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Exam Mode</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {examFlow.map((item) => (
              <li key={item} className="rounded-lg border border-slate-200 p-3">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Available mocks</h3>
        <p className="mt-1 text-sm text-slate-600">
          Choose practice for immediate feedback, or exam for a timed paper. Every published mock supports both.
        </p>
        <div className="mt-4 space-y-3">
          {mocks.map((mock) => {
            const qCount = Array.isArray(mock.questionIds) ? mock.questionIds.length : 0;
            return (
              <div
                key={mock.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{mock.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {qCount} questions • {mock.durationMinutes} min (exam)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/mocks/${mock.id}?mode=practice`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Practice
                  </Link>
                  <Link
                    href={`/mocks/${mock.id}?mode=exam`}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Exam
                  </Link>
                </div>
              </div>
            );
          })}
          {!loading && mocks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No mocks published yet. Ask your tutor to publish mocks in Admin.
            </p>
          ) : null}
          {loading ? (
            <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">Loading mocks…</p>
          ) : null}
        </div>
      </section>
    </PortalShell>
  );
}
