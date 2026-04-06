"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { FlkTrack } from "@/lib/types/admin";
import { usePortalLiveData } from "../lib/use-portal-live";
import SubjectsGridSkeleton from "./subjects-grid-skeleton";

type SubjectsListProps = {
  track?: FlkTrack;
  query?: string;
};

function subjectDescription(book: { description?: string; title: string } | undefined) {
  const d = book?.description?.trim();
  if (d) return d;
  const t = book?.title?.trim();
  if (t) return t;
  return "Study resources, audio, and practice for this subject.";
}

export default function SubjectsList({ track, query = "" }: SubjectsListProps) {
  const { subjects, books, audios, loading } = usePortalLiveData();
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSubjects = useMemo(() => {
    const list = track ? subjects.filter((s) => s.track === track) : [...subjects];
    const searched = list.filter((subject) => {
      if (!normalizedQuery) return true;
      return subject.name.toLowerCase().includes(normalizedQuery);
    });
    return searched.sort((a, b) => a.order - b.order);
  }, [subjects, track, normalizedQuery]);

  if (loading) {
    return <SubjectsGridSkeleton />;
  }

  return (
    <section className="grid gap-4 sm:gap-5 md:grid-cols-2">
      {filteredSubjects.map((subject) => {
        const subjectBooks = books.filter((b) => b.subjectId === subject.id);
        const book = subjectBooks[0];
        const subjectAudios = audios.filter((a) => a.subjectId === subject.id);
        const bookCount = subjectBooks.length;
        const audioCount = subjectAudios.length;

        return (
          <Link
            key={subject.id}
            href={`/subjects/${subject.id}`}
            className="group flex flex-col rounded-xl border border-[#121f1d]/10 bg-white p-5 shadow-sm transition hover:border-[#26d9c0]/35 hover:shadow-md sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold leading-snug text-[#121f1d] sm:text-xl">
                {subject.name}
              </h3>
              <span
                className="mt-1 shrink-0 text-lg font-light text-[#121f1d]/35 transition group-hover:translate-x-0.5 group-hover:text-[#26d9c0]"
                aria-hidden
              >
                →
              </span>
            </div>

            <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-[#121f1d]/55">
              {subjectDescription(book)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#121f1d]/45">
              <span className="inline-flex items-center gap-1.5">
                <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                {bookCount === 1 ? "1 book" : `${bookCount} books`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M3 14v3a3 3 0 003 3h2v-9H6a3 3 0 00-3 3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M21 14v3a3 3 0 01-3 3h-2v-9h2a3 3 0 013 3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M21 14v-5a9 9 0 00-18 0v5"
                  />
                </svg>
                {audioCount === 1 ? "1 audio" : `${audioCount} audios`}
              </span>
            </div>
          </Link>
        );
      })}
      {filteredSubjects.length === 0 ? (
        <p className="col-span-full rounded-xl border border-dashed border-[#121f1d]/20 bg-white p-8 text-center text-sm text-[#121f1d]/55">
          No published subjects available yet.
        </p>
      ) : null}
    </section>
  );
}
