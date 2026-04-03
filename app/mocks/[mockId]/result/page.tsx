"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PortalShell from "@/app/components/portal-shell";
import { studentApi } from "@/lib/services/student-api";
import type { StudentAttempt } from "@/lib/types/student";

export default function MockResultPage() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);

  useEffect(() => {
    const load = async () => {
      const attempts = (await studentApi.listAttempts()) as StudentAttempt[];
      setAttempt(attempts.find((item) => item.id === attemptId) || null);
    };
    if (attemptId) load().catch(() => setAttempt(null));
  }, [attemptId]);

  return (
    <PortalShell title="Mock Result" subtitle="Review your score and answer performance.">
      {!attempt ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
          Result not found.
        </section>
      ) : (
        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Score: <span className="font-semibold text-slate-900">{attempt.score}%</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Correct answers: {attempt.answers.filter((item) => item.isCorrect).length} /{" "}
              {attempt.totalQuestions}
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/mocks" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                Back to Mocks
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Answer Review</h3>
            <div className="mt-3 space-y-2">
              {attempt.answers.map((answer, index) => (
                <div
                  key={`${answer.mcqId}-${index}`}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    answer.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                  }`}
                >
                  Q{index + 1} • Selected: {answer.selectedOption + 1} • Correct:{" "}
                  {answer.correctOption + 1}
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </PortalShell>
  );
}
