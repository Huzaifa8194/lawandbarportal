"use client";

import Link from "next/link";
import type { FlkTrack } from "@/lib/types/admin";
import { usePortalLiveData } from "../lib/use-portal-live";

type SubjectsListProps = {
  track?: FlkTrack;
};

export default function SubjectsList({ track }: SubjectsListProps) {
  const { subjects, books, audios, videos, mocks, loading } = usePortalLiveData();
  const filteredSubjects = track ? subjects.filter((subject) => subject.track === track) : subjects;

  return (
    <section className="space-y-4">
      {filteredSubjects.map((subject) => {
        const book = books.find((item) => item.subjectId === subject.id);
        const subjectAudios = audios.filter((item) => item.subjectId === subject.id);
        const subjectVideos = videos.filter((item) => item.subjectId === subject.id);
        const subjectMocks = mocks.filter((item) => item.subjectIds.includes(subject.id));
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

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Book Viewer</p>
                <p className="mt-2 text-sm text-slate-600">{book?.title || "No book uploaded yet."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Read + Study Tools
                  </Link>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Audio Lessons ({subjectAudios.length})</p>
                <div className="mt-2 space-y-2">
                  {subjectAudios.slice(0, 3).map((audio) => (
                    <p key={audio.id} className="text-sm text-slate-600">
                      {audio.title}
                    </p>
                  ))}
                  {!subjectAudios.length ? <p className="text-sm text-slate-600">No audio uploaded yet.</p> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/subjects/${subject.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                    Open all audios
                  </Link>
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Videos & Mocks</p>
                <p className="mt-2 text-sm text-slate-600">Videos: {subjectVideos.length}</p>
                <p className="text-sm text-slate-600">Mocks: {subjectMocks.length}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/subjects/${subject.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                    Watch videos
                  </Link>
                  <Link href="/mocks" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                    Start mock
                  </Link>
                </div>
              </section>
            </div>
          </article>
        );
      })}
      {!loading && filteredSubjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          No published subjects available yet.
        </p>
      ) : null}
    </section>
  );
}
