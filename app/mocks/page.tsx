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
  const practice = mocks.filter((item) => item.revealAnswersInPractice);
  const exams = mocks.filter((item) => item.examMode);

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
          <div className="mt-4 space-y-2">
            {practice.slice(0, 4).map((mock) => (
              <Link
                href={`/mocks/${mock.id}?mode=practice`}
                key={mock.id}
                className="block rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
              >
                {mock.title} • {mock.questionIds.length} questions
              </Link>
            ))}
            {!loading && practice.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                No practice mocks published yet.
              </p>
            ) : null}
          </div>
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
          <div className="mt-4 space-y-2">
            {exams.slice(0, 4).map((mock) => (
              <Link
                href={`/mocks/${mock.id}?mode=exam`}
                key={mock.id}
                className="block rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
              >
                {mock.title} • {mock.durationMinutes} minutes
              </Link>
            ))}
            {!loading && exams.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                No exam mocks published yet.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
