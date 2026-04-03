import PortalShell from "../components/portal-shell";
import { latestMockScores, subjectResources } from "../lib/portal-data";

export default function ProgressPage() {
  return (
    <PortalShell
      title="Progress Tracking"
      subtitle="Track studied subjects, mock history, average scores, and weak areas in one overview."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Subject Progress</h3>
          <div className="mt-4 space-y-3">
            {subjectResources.map((resource) => (
              <div key={resource.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{resource.subject}</span>
                  <span>{resource.bookProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${resource.bookProgress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Latest Scores</h3>
          <div className="mt-4 space-y-2">
            {latestMockScores.map((score) => (
              <div
                key={score.name}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <p className="text-sm">{score.name}</p>
                <p className="text-sm font-semibold">{score.score}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
