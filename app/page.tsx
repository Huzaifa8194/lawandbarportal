"use client";

import Link from "next/link";
import { useMemo } from "react";
import PortalShell from "./components/portal-shell";
import { useAuth } from "./context/auth-context";
import { usePortalLiveData } from "./lib/use-portal-live";

function formatActivityDate(iso?: string) {
  if (!iso) return "Recently";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Recently";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "Recently";
  }
}

export default function Home() {
  const { user } = useAuth();
  const { subjects, books, audios, attempts, mocks, loading, attemptsLoading } = usePortalLiveData();

  const firstName = useMemo(() => {
    const dn = user?.displayName?.trim();
    if (dn) return dn.split(/\s+/)[0] ?? "Student";
    const fromEmail = user?.email?.split("@")[0]?.replace(/\./g, " ");
    if (fromEmail) return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
    return "Student";
  }, [user]);

  const flk1Subjects = useMemo(
    () =>
      subjects
        .filter((s) => s.track === "FLK 1")
        .sort((a, b) => a.order - b.order),
    [subjects],
  );
  const flk2Subjects = useMemo(
    () =>
      subjects
        .filter((s) => s.track === "FLK 2")
        .sort((a, b) => a.order - b.order),
    [subjects],
  );

  const preview = (list: typeof flk1Subjects, n: number) => list.slice(0, n);

  const activitiesCount = useMemo(() => {
    return subjects.filter(
      (s) =>
        books.some((b) => b.subjectId === s.id) || audios.some((a) => a.subjectId === s.id),
    ).length;
  }, [subjects, books, audios]);

  const recentAttempts = useMemo(() => {
    return [...attempts]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [attempts]);

  return (
    <PortalShell title="" subtitle="" hideHeader>
      <div className="space-y-8 sm:space-y-10">
        <section>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#0d4a42] sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[#121f1d]/65 sm:text-lg">
            Continue your SQE preparation journey.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42] sm:size-11">
                <svg className="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-semibold tabular-nums text-[#121f1d] sm:text-3xl">
              {loading ? "–" : flk1Subjects.length}
            </p>
            <p className="mt-1 text-xs font-medium text-[#121f1d]/55 sm:text-sm">FLK 1 Subjects</p>
          </article>

          <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42] sm:size-11">
                <svg className="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-semibold tabular-nums text-[#121f1d] sm:text-3xl">
              {loading ? "–" : flk2Subjects.length}
            </p>
            <p className="mt-1 text-xs font-medium text-[#121f1d]/55 sm:text-sm">FLK 2 Subjects</p>
          </article>

          <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 sm:size-11">
                <svg className="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-semibold tabular-nums text-[#121f1d] sm:text-3xl">
              {loading || attemptsLoading ? "–" : attempts.length}
            </p>
            <p className="mt-1 text-xs font-medium text-[#121f1d]/55 sm:text-sm">Mock attempts</p>
          </article>

          <article className="rounded-2xl border border-[#121f1d]/8 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42] sm:size-11">
                <svg className="size-5 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-[family-name:var(--font-playfair)] text-2xl font-semibold tabular-nums text-[#121f1d] sm:text-3xl">
              {loading ? "–" : activitiesCount}
            </p>
            <p className="mt-1 text-xs font-medium text-[#121f1d]/55 sm:text-sm">Activities</p>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <article className="flex flex-col rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-[#121f1d]/8 pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#121f1d]">FLK 1</h2>
            </div>
            <ul className="mt-4 flex-1 divide-y divide-[#121f1d]/8">
              {preview(flk1Subjects, 6).map((subject) => (
                <li key={subject.id}>
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="group flex items-center justify-between gap-3 py-3.5 text-sm font-medium text-[#121f1d] transition hover:text-[#0d4a42]"
                  >
                    <span className="min-w-0 truncate">{subject.name}</span>
                    <svg
                      className="size-4 shrink-0 text-[#121f1d]/35 transition group-hover:translate-x-0.5 group-hover:text-[#26d9c0]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
              {!loading && flk1Subjects.length === 0 ? (
                <li className="py-6 text-center text-sm text-[#121f1d]/55">No FLK 1 subjects published yet.</li>
              ) : null}
            </ul>
            <Link
              href="/subjects/flk1"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0d4a42] transition hover:text-[#26d9c0]"
            >
              View all FLK 1 subjects
              <span aria-hidden>→</span>
            </Link>
          </article>

          <article className="flex flex-col rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-[#121f1d]/8 pb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#121f1d]">FLK 2</h2>
            </div>
            <ul className="mt-4 flex-1 divide-y divide-[#121f1d]/8">
              {preview(flk2Subjects, 6).map((subject) => (
                <li key={subject.id}>
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="group flex items-center justify-between gap-3 py-3.5 text-sm font-medium text-[#121f1d] transition hover:text-[#0d4a42]"
                  >
                    <span className="min-w-0 truncate">{subject.name}</span>
                    <svg
                      className="size-4 shrink-0 text-[#121f1d]/35 transition group-hover:translate-x-0.5 group-hover:text-[#26d9c0]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
              {!loading && flk2Subjects.length === 0 ? (
                <li className="py-6 text-center text-sm text-[#121f1d]/55">No FLK 2 subjects published yet.</li>
              ) : null}
            </ul>
            <Link
              href="/subjects/flk2"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0d4a42] transition hover:text-[#26d9c0]"
            >
              View all FLK 2 subjects
              <span aria-hidden>→</span>
            </Link>
          </article>
        </section>

        <section className="rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 border-b border-[#121f1d]/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#121f1d]">Recent activity</h2>
            <Link href="/mocks" className="text-sm font-medium text-[#0d4a42] hover:text-[#26d9c0]">
              Go to mocks
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {attemptsLoading ? (
              <li className="rounded-xl border border-[#121f1d]/8 bg-[#f8f9fa] px-4 py-6 text-center text-sm text-[#121f1d]/55">
                Loading mock scores…
              </li>
            ) : null}
            {!attemptsLoading &&
              recentAttempts.map((item) => {
                const mockTitle = mocks.find((m) => m.id === item.mockId)?.title;
                const label = mockTitle || `Mock ${(item.mockId ?? "").slice(0, 8) || "—"}…`;
                const modeLabel = item.mode === "exam" ? "Exam" : "Practice";
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-[#121f1d]/8 bg-[#f8f9fa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#121f1d]">{label}</p>
                      <p className="text-xs text-[#121f1d]/50">
                        {formatActivityDate(item.createdAt)}
                        <span className="text-[#121f1d]/40"> · </span>
                        <span className="font-medium text-[#121f1d]/60">{modeLabel}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-[#0d4a42] ring-1 ring-[#121f1d]/10">
                        {item.score}%
                      </span>
                      <Link
                        href={`/mocks/${encodeURIComponent(item.mockId)}/result?attemptId=${encodeURIComponent(item.id)}`}
                        className="text-sm font-medium text-[#0d4a42] hover:text-[#26d9c0]"
                      >
                        Review result
                      </Link>
                    </div>
                  </li>
                );
              })}
            {!loading && !attemptsLoading && recentAttempts.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[#121f1d]/20 bg-[#f8f9fa] px-4 py-8 text-center text-sm text-[#121f1d]/55">
                No mock attempts yet. Start a mock under Mock exams to see scores here.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </PortalShell>
  );
}
