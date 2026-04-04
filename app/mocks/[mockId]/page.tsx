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
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const autoSubmitDoneRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSessionError("Sign in to start a mock exam.");
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
        autoSubmitDoneRef.current = false;
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
    if (!mock || !questions.length || submitting) return;

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
    setSubmitting(true);
    try {
      const response = (await studentApi.createAttempt({
        mockId: id,
        mode,
        score,
        totalQuestions: questions.length,
        answers,
      })) as { id: string };
      setSubmitted(true);
      router.push(
        `/mocks/${encodeURIComponent(id)}/result?attemptId=${encodeURIComponent(response.id)}`,
      );
    } catch (e) {
      setSubmitting(false);
      setSessionError(e instanceof Error ? e.message : "Could not save your attempt. Try again.");
    }
  }, [mock, questions, selected, mode, router, submitting]);

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
    if (
      mode === "exam" &&
      timeLeft === 0 &&
      !submitted &&
      questions.length &&
      !submitting &&
      !autoSubmitDoneRef.current
    ) {
      autoSubmitDoneRef.current = true;
      void submitRef.current();
    }
  }, [mode, timeLeft, submitted, questions.length, submitting]);

  if (authLoading || sessionLoading) {
    return (
      <PortalShell
        title="Loading mock exam"
        subtitle="Law & Bar SQE Study Portal"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Preparing questions and timer…
        </div>
      </PortalShell>
    );
  }

  if (sessionError || !mock || !questions.length) {
    return (
      <PortalShell
        title="Mock unavailable"
        subtitle="Law & Bar SQE Study Portal"
      >
        <div className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">
            {sessionError ??
              "This mock has no questions yet, is unpublished, or your account does not have access."}
          </p>
          <Link
            href="/mocks"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to mock exams
          </Link>
        </div>
      </PortalShell>
    );
  }

  const current = questions[index];
  const selectedOption = selected[current.id];
  const isPractice = mode === "practice";
  const instantFeedback =
    isPractice && mock.revealAnswersInPractice !== false && selectedOption !== undefined;
  const showPracticeFeedback = instantFeedback;

  const answeredCount = Object.keys(selected).length;
  const tick = timeLeft ?? 0;
  const minutes = Math.floor(tick / 60);
  const seconds = tick % 60;

  const modeTitle = isPractice ? "Practice mode" : "Exam mode";
  const modeDescription = isPractice
    ? mock.revealAnswersInPractice === false
      ? "Work through questions one at a time without instant marking. You will see the full score and explanations after you submit."
      : "After you choose an answer, you will see whether it was correct and read the explanation before moving on."
    : "Timed session: no marking until you submit. When time runs out, your attempt is submitted automatically. You will then see your score and a full review with explanations.";

  return (
    <PortalShell
      title={mock.title}
      subtitle={`Law & Bar SQE Study Portal · ${mock.track} · ${modeTitle}`}
    >
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">{modeTitle}</p>
        <p className="mt-1 text-slate-600">{modeDescription}</p>
        <p className="mt-2 text-xs text-slate-500">
          {questions.length} question{questions.length === 1 ? "" : "s"} · {answeredCount} answered
          {isPractice ? "" : ` · ${mock.durationMinutes} minute allowance`}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">
            Question {index + 1} of {questions.length}
          </p>
          {mode === "exam" ? (
            <p
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium tabular-nums text-white"
              aria-live="polite"
            >
              Time left {timeLeft === null ? "…" : `${minutes}:${String(seconds).padStart(2, "0")}`}
            </p>
          ) : null}
        </div>

        <h2 className="text-lg font-semibold leading-snug text-slate-900">{current.question}</h2>
        <div className="mt-4 space-y-2" role="group" aria-label="Answer choices">
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
                className={`block w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  showCorrect
                    ? "border-emerald-500 bg-emerald-50"
                    : showWrong
                      ? "border-red-500 bg-red-50"
                      : selectedThis
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-500">{String.fromCharCode(65 + optionIndex)}. </span>
                {option}
              </button>
            );
          })}
        </div>

        {showPracticeFeedback ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {selectedOption === current.correctOption ? (
              <span className="font-medium text-emerald-800">Correct. </span>
            ) : (
              <span className="font-medium text-red-800">Incorrect. </span>
            )}
            {current.explanation}
          </p>
        ) : isPractice && mock.revealAnswersInPractice === false && selectedOption !== undefined ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            Answer recorded. Full explanations will appear on the results screen after you submit.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitted || submitting}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting
              ? "Saving results…"
              : isPractice
                ? "Submit and view results"
                : "Submit exam and view results"}
          </button>
          <Link
            href="/mocks"
            className="inline-flex items-center rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Exit without submitting
          </Link>
        </div>
      </section>
    </PortalShell>
  );
}
