"use client";

import PortalShell from "../components/portal-shell";
import { normalizeMockQuestionIds } from "@/lib/normalize-mock-question-ids";
import { usePortalLiveData } from "../lib/use-portal-live";
import Link from "next/link";

export default function MocksPage() {
  const { mocks, loading } = usePortalLiveData({ includeAttempts: false });

  return (
    <PortalShell
      title="Mock exams & MCQs"
      subtitle="Law & Bar SQE Study Portal — timed exam practice and instant-feedback study mode"
    >
      <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Two ways to use each mock</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-slate-600">
          <li>
            <span className="font-medium text-slate-800">Practice mode</span> — one question at a time.
            Depending on how the mock was built, you may see correct/incorrect feedback and the explanation
            immediately, or only after you finish (see on-screen instructions when you start).
          </li>
          <li>
            <span className="font-medium text-slate-800">Exam mode</span> — full mock with countdown timer.
            You will not see correct answers until you submit (or time expires). Then you get your score and a
            full review with explanations, in line with SQE-style delivery.
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Scores are saved to your progress so you can track improvement and retake mocks as often as you
          need.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {mocks.map((mock) => {
          const qCount = normalizeMockQuestionIds(mock.questionIds).length;
          return (
            <article
              key={mock.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white">
                    <svg className="size-5 text-slate-700" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 16h.01M12 16h.01M15 16h.01M9 12h.01M12 12h.01M15 12h.01"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                    {mock.track}
                  </span>
                </div>
              </div>

              <h3 className="mt-4 truncate text-xl font-semibold text-slate-900">{mock.title}</h3>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <svg className="size-4 text-slate-700" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M7 3h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 8h6M9 12h6M9 16h4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {qCount} MCQ{qCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg className="size-4 text-slate-700" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 8v4l2 2"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {mock.durationMinutes} min (exam mode)
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link
                  href={`/mocks/${encodeURIComponent(mock.id)}?mode=practice`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M8 5v14l12-7-12-7Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Practice
                </Link>
                <Link
                  href={`/mocks/${encodeURIComponent(mock.id)}?mode=exam`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 8v4l2 2"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Exam mode
                </Link>
              </div>
            </article>
          );
        })}

        {!loading && mocks.length === 0 ? (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No published mocks yet. Your programme team can add them from the admin panel.
          </div>
        ) : null}

        {loading ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Loading mock exams…
          </div>
        ) : null}
      </section>
    </PortalShell>
  );
}
