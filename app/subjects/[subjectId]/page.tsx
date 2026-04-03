"use client";

import { useParams } from "next/navigation";
import PortalShell from "../../components/portal-shell";
import { usePortalLiveData } from "../../lib/use-portal-live";

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
  const { subjects, books, audios, mcqs, loading } = usePortalLiveData();
  const subject = subjects.find((item) => item.id === params.subjectId);
  const relatedBook = books.find((item) => item.subjectId === params.subjectId);
  const relatedAudio = audios.find((item) => item.subjectId === params.subjectId);
  const relatedQuestions = mcqs.filter((question) => question.subjectId === params.subjectId);

  return (
    <PortalShell
      title={`${subject?.name || "Subject"} Workspace`}
      subtitle="Read the book and listen to related audio together, then test knowledge with MCQs."
    >
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">PDF Book Viewer</h3>
          <p className="mt-2 text-sm text-slate-600">{relatedBook?.title || "No book uploaded yet."}</p>
          <p className="mt-1 text-sm text-slate-600">
            Last opened page and bookmarks should be persisted for each student.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            PDF viewer area (embed actual viewer in next step)
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Audio Lesson</h3>
          <p className="mt-2 text-sm text-slate-600">{relatedAudio?.title || "No audio uploaded yet."}</p>
          <p className="mt-1 text-sm text-slate-600">
            Duration: {relatedAudio?.durationSeconds ? `${relatedAudio.durationSeconds}s` : "N/A"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Play / Pause
            </button>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium">
              Seek
            </button>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium">
              1x / 1.5x / 2x
            </button>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Related MCQs</h3>
        <div className="mt-4 space-y-3">
          {relatedQuestions.length === 0 ? (
            <p className="text-sm text-slate-600">
              No questions assigned to this subject yet.
            </p>
          ) : (
            relatedQuestions.map((question) => (
              <article key={question.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-medium">{question.question}</p>
                <p className="mt-2 text-sm text-slate-600">
                  5 options, single-answer structure configured.
                </p>
              </article>
            ))
          )}
        </div>
      </section>
      {!loading && !subject ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          Subject not found or not published.
        </section>
      ) : null}
    </PortalShell>
  );
}
