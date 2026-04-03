"use client";

import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";

export default function ProgressPage() {
  const { subjects, attempts, loading } = usePortalLiveData();
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : 0;

  return (
    <PortalShell
      title="Progress Tracking"
      subtitle="Track studied subjects, mock history, average scores, and weak areas in one overview."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Subject Progress</h3>
          <div className="mt-4 space-y-3">
            {subjects.map((resource, index) => {
              const fakeProgress = Math.max(20, Math.min(100, 35 + index * 15));
              return (
              <div key={resource.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{resource.name}</span>
                  <span>{fakeProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${fakeProgress}%` }}
                  />
                </div>
              </div>
            );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Latest Scores (Avg: {loading ? "-" : `${average}%`})</h3>
          <div className="mt-4 space-y-2">
            {attempts.slice(0, 8).map((score) => (
              <div
                key={score.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <p className="text-sm">Mock {score.mockId}</p>
                <p className="text-sm font-semibold">{score.score}%</p>
              </div>
            ))}
            {!loading && attempts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
                No mock attempts recorded yet.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
