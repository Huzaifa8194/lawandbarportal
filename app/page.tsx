"use client";

import Link from "next/link";
import PortalShell from "./components/portal-shell";
import { usePortalLiveData } from "./lib/use-portal-live";

export default function Home() {
  const { subjects, books, audios, attempts, loading } = usePortalLiveData();
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : 0;
  const continueItems = subjects.slice(0, 4).map((subject) => ({
    subject,
    book: books.find((book) => book.subjectId === subject.id),
    audio: audios.find((audio) => audio.subjectId === subject.id),
  }));

  return (
    <PortalShell
      title="Welcome back, Student"
      subtitle="Continue learning with your FLK books, related audio lessons, and latest mock attempts."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Subjects in progress</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "-" : subjects.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Average mock score</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "-" : `${averageScore}%`}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Recent attempts</p>
          <p className="mt-2 text-2xl font-semibold">{loading ? "-" : attempts.length}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Continue Learning</h3>
          <div className="mt-4 space-y-3">
            {continueItems.map((resource) => (
              <div
                key={resource.subject.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resource.subject.track}
                </p>
                <p className="mt-1 font-semibold">{resource.subject.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {resource.book?.title || "No published book yet"}
                </p>
                <p className="text-sm text-slate-600">
                  {resource.audio?.title || "No published audio yet"}
                </p>
                <Link
                  href={`/subjects/${resource.subject.id}`}
                  className="mt-3 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                >
                  Open subject workspace
                </Link>
              </div>
            ))}
            {!loading && continueItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                No published subjects yet. Your dashboard will populate as soon as content is assigned.
              </p>
            ) : null}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Latest Mock Scores</h3>
          <div className="mt-4 space-y-3">
            {attempts.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium">Mock ID: {item.mockId}</p>
                  <p className="text-sm text-slate-500">Attempted</p>
                </div>
                <p className="text-lg font-semibold">{item.score}%</p>
              </div>
            ))}
            {!loading && attempts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                No attempts yet. Start a mock exam to generate progress history.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
