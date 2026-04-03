"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import AudioPlayer from "../../components/student/audio-player";
import PdfWorkspace from "../../components/student/pdf-workspace";
import PortalShell from "../../components/portal-shell";
import { usePortalLiveData } from "../../lib/use-portal-live";

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
  const { subjects, books, audios, videos, mcqs, mocks, loading } = usePortalLiveData();
  const subject = subjects.find((item) => item.id === params.subjectId);
  const relatedBook = books.find((item) => item.subjectId === params.subjectId);
  const relatedAudios = audios.filter((item) => item.subjectId === params.subjectId);
  const relatedVideos = videos.filter((item) => item.subjectId === params.subjectId);
  const relatedMocks = mocks.filter((item) => item.subjectIds.includes(params.subjectId));
  const relatedQuestions = mcqs.filter((question) => question.subjectId === params.subjectId);

  return (
    <PortalShell
      title={`${subject?.name || "Subject"} Workspace`}
      subtitle="Read the book and listen to related audio together, then test knowledge with MCQs."
    >
      <section className="grid gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">PDF Book Viewer</h3>
          <p className="mt-2 text-sm text-slate-600">
            {relatedBook?.title || "No book uploaded yet."}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Last opened page and bookmarks should be persisted for each student.
          </p>
          {relatedBook ? (
            <div className="mt-4">
              <PdfWorkspace
                bookId={relatedBook.id}
                title={relatedBook.title}
                fileUrl={relatedBook.fileUrl}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Ask admin to upload and publish a book for this subject.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Audio Lessons</h3>
          <p className="mt-2 text-sm text-slate-600">
            You can play any audio below. Multiple audios are supported for each subject.
          </p>
          <div className="mt-4 space-y-4">
            {relatedAudios.map((audio) => (
              <div key={audio.id} className="rounded-xl border border-slate-200 p-4">
                <AudioPlayer audioId={audio.id} audioUrl={audio.fileUrl} title={audio.title} />
              </div>
            ))}
            {!relatedAudios.length ? (
              <p className="text-sm text-slate-600">No audio uploaded yet.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Video Lessons</h3>
          <div className="mt-4 space-y-4">
            {relatedVideos.map((video) => (
              <div key={video.id} className="rounded-xl border border-slate-200 p-4">
                <p className="mb-2 text-sm font-medium">{video.title}</p>
                <video controls className="w-full rounded-lg border border-slate-200" src={video.fileUrl} />
              </div>
            ))}
            {!relatedVideos.length ? (
              <p className="text-sm text-slate-600">No video lessons uploaded yet.</p>
            ) : null}
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
                <Link
                  href="/mocks"
                  className="mt-3 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                >
                  Open Mocks
                </Link>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Available Mocks</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedMocks.map((mock) => (
            <Link
              key={mock.id}
              href={`/mocks/${mock.id}?mode=practice`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              Practice: {mock.title}
            </Link>
          ))}
          {relatedMocks.map((mock) => (
            <Link
              key={`${mock.id}-exam`}
              href={`/mocks/${mock.id}?mode=exam`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              Exam: {mock.title}
            </Link>
          ))}
          {!relatedMocks.length ? (
            <p className="text-sm text-slate-600">No mocks linked to this subject yet.</p>
          ) : null}
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
