"use client";

import { useMemo } from "react";
import PortalShell from "../components/portal-shell";
import { usePortalLiveData } from "../lib/use-portal-live";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ProgressPage() {
  const { subjects, attempts, mcqs, mocks, loading } = usePortalLiveData();

  const mockTitleById = useMemo(() => new Map(mocks.map((m) => [m.id, m.title])), [mocks]);
  const mcqSubjectById = useMemo(() => new Map(mcqs.map((m) => [m.id, m.subjectId])), [mcqs]);

  const average = attempts.length
    ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length)
    : 0;

  const subjectStats = useMemo(() => {
    const tallies = new Map<string, { name: string; correct: number; total: number }>();
    for (const s of subjects) {
      tallies.set(s.id, { name: s.name, correct: 0, total: 0 });
    }
    for (const attempt of attempts) {
      for (const answer of attempt.answers ?? []) {
        const subjectId = mcqSubjectById.get(answer.mcqId);
        if (!subjectId) continue;
        const row = tallies.get(subjectId);
        if (!row) continue;
        row.total += 1;
        if (answer.isCorrect) row.correct += 1;
      }
    }
    return subjects.map((s) => {
      const t = tallies.get(s.id) ?? { name: s.name, correct: 0, total: 0 };
      const pct = t.total > 0 ? Math.round((t.correct / t.total) * 100) : null;
      return { id: s.id, ...t, pct };
    });
  }, [attempts, subjects, mcqSubjectById]);

  const weakAreas = subjects
    .map((subject) => {
      const subjectMcqIds = mcqs
        .filter((question) => question.subjectId === subject.id)
        .map((question) => question.id);
      const wrong = attempts.flatMap((attempt) => attempt.answers || []).filter(
        (answer) => subjectMcqIds.includes(answer.mcqId) && !answer.isCorrect,
      ).length;
      return { subject: subject.name, wrong };
    })
    .filter((item) => item.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5);

  return (
    <PortalShell
      title="Progress Tracking"
      subtitle="Mock history, score averages, per-subject accuracy from your attempts, and weak areas."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Subject accuracy (from mocks)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Based on questions you answered in recorded mock attempts.
          </p>
          <div className="mt-4 space-y-3">
            {subjectStats.map((resource) => {
              const pct = resource.pct ?? 0;
              const displayPct = resource.total === 0 ? null : pct;
              return (
                <div key={resource.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{resource.name}</span>
                    <span className="text-slate-600">
                      {displayPct === null ? "No data yet" : `${displayPct}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-700 transition-[width]"
                      style={{
                        width: displayPct === null ? "0%" : `${Math.min(100, Math.max(0, displayPct))}%`,
                      }}
                    />
                  </div>
                  {resource.total > 0 ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {resource.correct} / {resource.total} graded items
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Latest scores (Avg: {loading ? "—" : `${average}%`})</h3>
          <div className="mt-4 space-y-2">
            {attempts.slice(0, 8).map((score) => (
              <div
                key={score.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {mockTitleById.get(score.mockId) ?? `Mock ${score.mockId}`}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(score.createdAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{score.score}%</p>
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Weak areas</h3>
        <p className="mt-1 text-xs text-slate-500">
          Subjects with the most incorrect answers across your attempts.
        </p>
        <div className="mt-3 space-y-2">
          {weakAreas.map((item) => (
            <div
              key={item.subject}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span>{item.subject}</span>
              <span>{item.wrong} incorrect answers</span>
            </div>
          ))}
          {!loading && weakAreas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
              No weak areas detected yet. Complete more mocks to generate insights.
            </p>
          ) : null}
        </div>
      </section>
    </PortalShell>
  );
}
