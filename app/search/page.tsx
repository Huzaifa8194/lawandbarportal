"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { subjects, books, audios, mcqs, mocks } = usePortalLiveData();
  const q = query.trim().toLowerCase();

  const filteredSubjects = useMemo(
    () => subjects.filter((item) => !q || item.name.toLowerCase().includes(q)),
    [q, subjects],
  );
  const filteredMcqs = useMemo(
    () => mcqs.filter((item) => !q || item.question.toLowerCase().includes(q)),
    [mcqs, q],
  );
  const filteredMocks = useMemo(
    () => mocks.filter((item) => !q || item.title.toLowerCase().includes(q)),
    [mocks, q],
  );

  return (
    <PortalShell
      title="Search"
      subtitle="Search across books, audio lessons, subjects, and MCQs."
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-slate-700" htmlFor="portal-search">
          Global search
        </label>
        <input
          id="portal-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subjects, books, audios, mock questions..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
        />
        <p className="mt-2 text-xs text-slate-500">
          Search is scoped across published subjects, books, audios, MCQs, and mock exams.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Books & Audio</h3>
          <div className="mt-4 space-y-2">
            {filteredSubjects.map((item) => {
              const book = books.find((bookItem) => bookItem.subjectId === item.id);
              const audio = audios.find((audioItem) => audioItem.subjectId === item.id);
              return (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-slate-600">
                  {book?.title || "No book"} | {audio?.title || "No audio"}
                </p>
                <Link href={`/subjects/${item.id}`} className="mt-2 inline-block text-xs text-slate-700 underline">
                  Open subject
                </Link>
              </div>
              );
            })}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">MCQs</h3>
          <div className="mt-4 space-y-2">
            {filteredMcqs.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.subjectName}</p>
                <p className="text-xs text-slate-600">{item.question}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Mocks</h3>
          <div className="mt-4 space-y-2">
            {filteredMocks.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-slate-600">
                  {item.track} • {item.durationMinutes} min
                </p>
                <div className="mt-2 flex gap-2">
                  <Link href={`/mocks/${item.id}?mode=practice`} className="text-xs underline">
                    Practice
                  </Link>
                  <Link href={`/mocks/${item.id}?mode=exam`} className="text-xs underline">
                    Exam
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
