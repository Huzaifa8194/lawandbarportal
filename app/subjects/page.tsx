"use client";

import Link from "next/link";
import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";

export default function SubjectsPage() {
  const { subjects, books, audios, loading } = usePortalLiveData();

  return (
    <PortalShell
      title="Subjects: Books + Audio Together"
      subtitle="Each SQE subject groups the PDF book and related audio lessons in one place so students can read and listen simultaneously."
    >
      <section className="space-y-4">
        {subjects.map((subject) => {
          const book = books.find((item) => item.subjectId === subject.id);
          const audio = audios.find((item) => item.subjectId === subject.id);
          return (
          <article
            key={subject.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {subject.track}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{subject.name}</h3>
              </div>
              <Link
                href={`/subjects/${subject.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                Open Subject Workspace
              </Link>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Book Viewer</p>
                <p className="mt-2 text-sm text-slate-600">{book?.title || "No book uploaded yet."}</p>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Audio Player</p>
                <p className="mt-2 text-sm text-slate-600">{audio?.title || "No audio uploaded yet."}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Duration: {audio?.durationSeconds ? `${audio.durationSeconds}s` : "N/A"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                    Play
                  </button>
                  <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">
                    1.5x
                  </button>
                </div>
              </section>
            </div>
          </article>
          );
        })}
        {!loading && subjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
            No published subjects available yet.
          </p>
        ) : null}
      </section>
    </PortalShell>
  );
}
