import PortalShell from "./components/portal-shell";
import { latestMockScores, subjectResources } from "./lib/portal-data";

export default function Home() {
  return (
    <PortalShell
      title="Welcome back, Student"
      subtitle="Continue learning with your FLK books, related audio lessons, and latest mock attempts."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Subjects in progress</p>
          <p className="mt-2 text-2xl font-semibold">{subjectResources.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Average mock score</p>
          <p className="mt-2 text-2xl font-semibold">72%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Recent activity</p>
          <p className="mt-2 text-2xl font-semibold">12 this week</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Continue Learning</h3>
          <div className="mt-4 space-y-3">
            {subjectResources.map((resource) => (
              <div
                key={resource.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {resource.track}
                </p>
                <p className="mt-1 font-semibold">{resource.subject}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {resource.bookTitle} - {resource.bookProgress}% read
                </p>
                <p className="text-sm text-slate-600">
                  {resource.audioTitle} - resume at {resource.audioPosition}
                </p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Latest Mock Scores</h3>
          <div className="mt-4 space-y-3">
            {latestMockScores.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.mode} Mode</p>
                </div>
                <p className="text-lg font-semibold">{item.score}%</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
