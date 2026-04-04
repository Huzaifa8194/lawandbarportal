"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PortalShell from "@/app/components/portal-shell";
import { useAuth } from "@/app/context/auth-context";
import { studentApi } from "@/lib/services/student-api";
import type { Mcq } from "@/lib/types/admin";
import type { StudentAttempt } from "@/lib/types/student";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

function resolveParamId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function formatOptionLabel(index: number): string {
  if (index < 0 || index > 4) return "—";
  return OPTION_LETTERS[index] ?? String(index + 1);
}

export default function MockResultPage() {
  const params = useParams<{ mockId: string | string[] }>();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const routeMockId = resolveParamId(params.mockId);
  const attemptId = searchParams.get("attemptId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [questions, setQuestions] = useState<Mcq[]>([]);
  const [mockTitle, setMockTitle] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError("Sign in to view your mock results.");
      return;
    }
    if (!attemptId?.trim()) {
      setLoading(false);
      setError("This results link is missing a session id. Return to Mock exams and submit again.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const row = await studentApi.getAttempt(attemptId.trim());
        if (cancelled) return;

        const mockIdForBank = row.mockId || routeMockId;
        const session = await studentApi.getMockSession(mockIdForBank);
        if (cancelled) return;

        setAttempt(row);
        setQuestions(session.questions);
        setMockTitle(session.mock.title);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "We could not load this result. It may still be saving — try refreshing in a moment.",
          );
          setAttempt(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, attemptId, routeMockId]);

  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const reviewRows = useMemo(() => {
    if (!attempt?.answers?.length) return [];
    return attempt.answers.map((answer, index) => ({
      index: index + 1,
      answer,
      mcq: questionById.get(answer.mcqId) ?? null,
    }));
  }, [attempt, questionById]);

  const correctCount = attempt ? (attempt.answers ?? []).filter((a) => a.isCorrect).length : 0;
  const total =
    attempt?.totalQuestions ??
    attempt?.answers?.length ??
    0;

  if (authLoading || loading) {
    return (
      <PortalShell
        title="Results"
        subtitle="Law & Bar SQE Study Portal — preparing your score summary"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
          Loading your results…
        </div>
      </PortalShell>
    );
  }

  if (error || !attempt) {
    return (
      <PortalShell
        title="Results unavailable"
        subtitle="Law & Bar SQE Study Portal — mock exam"
      >
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">{error ?? "Result could not be loaded."}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/mocks"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Back to mock exams
            </Link>
            {attemptId ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
              >
                Refresh page
              </button>
            ) : null}
          </div>
        </section>
      </PortalShell>
    );
  }

  const modeLabel = attempt.mode === "practice" ? "Practice mode" : "Exam mode";
  const routeMismatch =
    routeMockId && attempt.mockId && routeMockId !== attempt.mockId;

  return (
    <PortalShell
      title="Mock exam results"
      subtitle={`Law & Bar SQE Study Portal · ${mockTitle || "Mock"} · ${modeLabel}`}
    >
      <section className="space-y-6">
        {routeMismatch ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Note: This attempt belongs to a different mock id than the URL segment; showing the correct
            attempt data below.
          </p>
        ) : null}

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-900">{attempt.score}%</p>
              <p className="mt-2 text-sm text-slate-600">
                {correctCount} correct out of {total} question{total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              {attempt.createdAt ? (
                <p>
                  Submitted{" "}
                  {new Date(attempt.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Review each question below: your choice, the correct answer, and the explanation (where
            provided). Retake anytime from Mock exams.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/mocks/${encodeURIComponent(attempt.mockId)}?mode=practice`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Practice this mock again
            </Link>
            <Link
              href={`/mocks/${encodeURIComponent(attempt.mockId)}?mode=exam`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Retake exam mode
            </Link>
            <Link
              href="/mocks"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              All mock exams
            </Link>
            <Link href="/progress" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              Progress & history
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Answer review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Explanations match the official MCQ bank. Wrong answers are highlighted for focused revision.
          </p>
          <div className="mt-5 space-y-4">
            {reviewRows.map(({ index, answer, mcq }) => (
              <div
                key={`${answer.mcqId}-${index}`}
                className={`rounded-xl border px-4 py-4 ${
                  answer.isCorrect ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Question {index}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      answer.isCorrect ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {answer.isCorrect ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {mcq?.question ?? "This question is no longer in the published mock bank."}
                </p>
                <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Your answer</dt>
                    <dd className="mt-0.5">
                      {answer.selectedOption < 0
                        ? "No answer selected"
                        : mcq
                          ? `${formatOptionLabel(answer.selectedOption)} — ${mcq.options[answer.selectedOption] ?? "—"}`
                          : `Option ${formatOptionLabel(answer.selectedOption)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Correct answer</dt>
                    <dd className="mt-0.5">
                      {mcq
                        ? `${formatOptionLabel(answer.correctOption)} — ${mcq.options[answer.correctOption] ?? "—"}`
                        : `Option ${formatOptionLabel(answer.correctOption)}`}
                    </dd>
                  </div>
                </dl>
                {mcq?.explanation ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-800">Explanation: </span>
                    {mcq.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
