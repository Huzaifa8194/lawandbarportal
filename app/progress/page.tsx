"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";
import { studentApi } from "@/lib/services/student-api";
import type { AudioStudyState, PdfStudyState } from "@/lib/types/student";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ProgressPage() {
  const { subjects, attempts, mocks, books, audios, loading } = usePortalLiveData();
  const [pdfStates, setPdfStates] = useState<Record<string, PdfStudyState | null>>({});
  const [audioStates, setAudioStates] = useState<Record<string, AudioStudyState | null>>({});

  const mockTitleById = useMemo(() => new Map(mocks.map((m) => [m.id, m.title])), [mocks]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!books.length) {
        if (active) setPdfStates({});
        return;
      }
      const rows = await Promise.all(
        books.map(async (book) => {
          try {
            const state = (await studentApi.getPdfState(book.id)) as PdfStudyState | null;
            return [book.id, state] as const;
          } catch {
            return [book.id, null] as const;
          }
        }),
      );
      if (active) setPdfStates(Object.fromEntries(rows));
    };
    void run();
    return () => {
      active = false;
    };
  }, [books]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!audios.length) {
        if (active) setAudioStates({});
        return;
      }
      const rows = await Promise.all(
        audios.map(async (audio) => {
          try {
            const state = (await studentApi.getAudioState(audio.id)) as AudioStudyState | null;
            return [audio.id, state] as const;
          } catch {
            return [audio.id, null] as const;
          }
        }),
      );
      if (active) setAudioStates(Object.fromEntries(rows));
    };
    void run();
    return () => {
      active = false;
    };
  }, [audios]);

  const subjectsViewed = useMemo(() => {
    const viewedSubjectIds = new Set(
      books
        .filter((book) => {
          const state = pdfStates[book.id];
          return Boolean(state?.updatedAt);
        })
        .map((book) => book.subjectId),
    );
    return viewedSubjectIds.size;
  }, [books, pdfStates]);

  const audiosPlayed = useMemo(() => {
    return audios.filter((audio) => {
      const state = audioStates[audio.id];
      return Boolean(state?.updatedAt) || (state?.currentSeconds ?? 0) > 0;
    }).length;
  }, [audios, audioStates]);

  const bestScore = attempts.length ? Math.max(...attempts.map((item) => item.score)) : 0;
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : 0;

  const recentSubjectViews = useMemo(() => {
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    return books
      .map((book) => {
        const state = pdfStates[book.id];
        if (!state?.updatedAt) return null;
        const subject = subjectMap.get(book.subjectId);
        if (!subject) return null;
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          track: subject.track,
          updatedAt: state.updatedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [books, pdfStates, subjects]);

  const examAttempts = useMemo(
    () => attempts.filter((attempt) => (attempt.mode ?? "practice") === "exam"),
    [attempts],
  );

  return (
    <PortalShell
      title="Progress"
      subtitle="Track your study activity and exam performance."
    >
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="mt-3 text-2xl font-semibold text-[#121f1d]">{loading ? "-" : subjectsViewed}</p>
          <p className="text-sm text-[#121f1d]/55">Subjects Viewed</p>
        </article>

        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6M7 20h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-3 text-2xl font-semibold text-[#121f1d]">{loading ? "-" : audiosPlayed}</p>
          <p className="text-sm text-[#121f1d]/55">Audio Played</p>
        </article>

        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-3 text-2xl font-semibold text-[#121f1d]">{loading ? "-" : `${bestScore}%`}</p>
          <p className="text-sm text-[#121f1d]/55">Best Score</p>
        </article>

        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </div>
          <p className="mt-3 text-2xl font-semibold text-[#121f1d]">{loading ? "-" : `${averageScore}%`}</p>
          <p className="text-sm text-[#121f1d]/55">Avg Score</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-semibold text-[#121f1d]">Recent Subject Views</h3>
          <div className="mt-4 space-y-2">
            {recentSubjectViews.map((item) => (
              <Link
                key={`${item.subjectId}-${item.updatedAt}`}
                href={`/subjects/${item.subjectId}`}
                className="group flex items-center justify-between rounded-lg px-2 py-2 transition hover:bg-[#f8f9fa]"
              >
                <div>
                  <p className="text-sm font-medium text-[#121f1d]">{item.subjectName}</p>
                  <p className="text-xs text-[#121f1d]/55">
                    {item.track} · {formatDate(item.updatedAt)}
                  </p>
                </div>
                <span className="text-[#121f1d]/40 transition group-hover:translate-x-0.5 group-hover:text-[#26d9c0]">
                  →
                </span>
              </Link>
            ))}
            {!loading && recentSubjectViews.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#121f1d]/55">No subject views yet.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-semibold text-[#121f1d]">Exam Attempts</h3>
          <div className="mt-4 space-y-3">
            {examAttempts.slice(0, 8).map((score) => (
              <div
                key={score.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#121f1d]/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#121f1d]">
                    {mockTitleById.get(score.mockId) ?? `Mock ${score.mockId}`}
                  </p>
                  <p className="text-xs text-[#121f1d]/55">{formatDate(score.createdAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[#0d4a42]">{score.score}%</p>
              </div>
            ))}
            {!loading && examAttempts.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#121f1d]/55">No exam attempts yet.</p>
            ) : null}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
