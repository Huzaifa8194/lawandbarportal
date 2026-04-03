"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PortalShell from "@/app/components/portal-shell";
import { useAuth } from "@/app/context/auth-context";
import type { Mcq, MockExam } from "@/lib/types/admin";
import { studentApi } from "@/lib/services/student-api";

function resolveParamId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

export default function MockSessionPage() {
  const params = useParams<{ mockId: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const mockId = resolveParamId(params.mockId);
  const mode = searchParams.get("mode") === "practice" ? "practice" : "exam";

  const [mock, setMock] = useState<MockExam | null>(null);
  const [questions, setQuestions] = useState<Mcq[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSessionError("You need to be signed in to start a mock.");
      setSessionLoading(false);
      return;
    }
    if (!mockId) {
      setSessionError("Invalid mock link.");
      setSessionLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setSessionLoading(true);
        setSessionError(null);
        const data = await studentApi.getMockSession(mockId);
        if (cancelled) return;
        setMock(data.mock);
        setQuestions(data.questions);
      } catch (e) {
        if (!cancelled) {
          setSessionError(e instanceof Error ? e.message : "Could not load this mock.");
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, mockId]);

  useEffect(() => {
    if (mode !== "exam" || !mock) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(Math.max(0, mock.durationMinutes * 60));
  }, [mode, mock]);

  const onSubmit = useCallback(async () => {
    if (!mock || !questions.length) return;

    const answers = questions.map((question) => {
      const choice = selected[question.id];
      return {
        mcqId: question.id,
        selectedOption: choice ?? -1,
        correctOption: question.correctOption,
        isCorrect: choice === question.correctOption,
      };
    });
    const correct = answers.filter((item) => item.isCorrect).length;
    const score = Math.round((correct / questions.length) * 100);
    const id = mock.id;
    const response = (await studentApi.createAttempt({
      mockId: id,
      mode,
      score,
      totalQuestions: questions.length,
      answers,
    })) as { id: string };
    setSubmitted(true);
    router.push(`/mocks/${id}/result?attemptId=${response.id}`);
  }, [mock, questions, selected, mode, router]);

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (mode !== "exam" || timeLeft === null || timeLeft <= 0 || submitted) return;
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev === null ? null : Math.max(0, prev - 1))),
      1000,
    );
    return () => clearInterval(timer);
  }, [mode, submitted, timeLeft]);

  useEffect(() => {
    if (mode === "exam" && timeLeft === 0 && !submitted && questions.length) {
      void submitRef.current();
    }
  }, [mode, timeLeft, submitted, questions.length]);

  if (authLoading || sessionLoading) {
    return (
      <PortalShell title="Loading mock..." subtitle="Preparing your session">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading...
        </div>
      </PortalShell>
    );
  }

  if (sessionError || !mock || !questions.length) {
    return (
      <PortalShell
        title="Mock unavailable"
        subtitle={sessionError ?? "This mock has no questions yet, or you do not have access."}
      >
        <Link href="/mocks" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          Back to mocks
        </Link>
      </PortalShell>
    );
  }

  const current = questions[index];
  const selectedOption = selected[current.id];
  const isPractice = mode === "practice";
  const showPracticeFeedback = isPractice && selectedOption !== undefined;

  const answeredCount = Object.keys(selected).length;
  const tick = timeLeft ?? 0;
  const minutes = Math.floor(tick / 60);
  const seconds = tick % 60;

  return (
    <PortalShell
      title={`${mock.title}`}
      subtitle={`${mode === "exam" ? "Exam Mode" : "Practice Mode"} • ${questions.length} questions`}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Question {index + 1} of {questions.length} • Answered: {answeredCount}
          </p>
          {mode === "exam" ? (
            <p className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              {timeLeft === null ? "…" : `${minutes}:${String(seconds).padStart(2, "0")}`}
            </p>
          ) : null}
        </div>

        <h3 className="text-lg font-semibold">{current.question}</h3>
        <div className="mt-4 space-y-2">
          {current.options.map((option, optionIndex) => {
            const selectedThis = selectedOption === optionIndex;
            const correctThis = current.correctOption === optionIndex;
            const showCorrect = showPracticeFeedback && correctThis;
            const showWrong = showPracticeFeedback && selectedThis && !correctThis;
            return (
              <button
                type="button"
                key={`${current.id}-${optionIndex}`}
                onClick={() => setSelected((prev) => ({ ...prev, [current.id]: optionIndex }))}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  showCorrect
                    ? "border-green-500 bg-green-50"
                    : showWrong
                      ? "border-red-500 bg-red-50"
                      : selectedThis
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-200"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {showPracticeFeedback ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {selectedOption === current.correctOption ? "Correct. " : "Incorrect. "}
            {current.explanation}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitted}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Submit Mock
          </button>
        </div>
      </section>
    </PortalShell>
  );
}
