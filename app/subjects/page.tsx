import Link from "next/link";
import PortalShell from "../components/portal-shell";
import { subjectResources } from "../lib/portal-data";

export default function SubjectsPage() {
  return (
    <PortalShell
      title="Subjects: Books + Audio Together"
      subtitle="Each SQE subject groups the PDF book and related audio lessons in one place so students can read and listen simultaneously."
    >
      <section className="space-y-4">
        {subjectResources.map((resource) => (
          <article
            key={resource.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resource.track}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{resource.subject}</h3>
              </div>
              <Link
                href={`/subjects/${resource.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                Open Subject Workspace
              </Link>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Book Viewer</p>
                <p className="mt-2 text-sm text-slate-600">{resource.bookTitle}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Reading progress: {resource.bookProgress}%
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${resource.bookProgress}%` }}
                  />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Audio Player</p>
                <p className="mt-2 text-sm text-slate-600">{resource.audioTitle}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Duration: {resource.audioDuration} | Resume: {resource.audioPosition}
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
        ))}
      </section>
    </PortalShell>
  );
}
