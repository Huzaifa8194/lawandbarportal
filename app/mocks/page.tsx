import PortalShell from "../components/portal-shell";

const practiceFlow = [
  "One question at a time",
  "Immediate answer and explanation",
  "Navigate next/previous",
];

const examFlow = [
  "Full paper with timer",
  "No answers until submission",
  "Final score and answer review",
];

export default function MocksPage() {
  return (
    <PortalShell
      title="Mock Exams & MCQs"
      subtitle="Students can switch between practice mode and full exam mode with tracked scores and review."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Practice Mode</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {practiceFlow.map((item) => (
              <li key={item} className="rounded-lg border border-slate-200 p-3">
                {item}
              </li>
            ))}
          </ul>
          <button className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Start Practice Session
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Exam Mode</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {examFlow.map((item) => (
              <li key={item} className="rounded-lg border border-slate-200 p-3">
                {item}
              </li>
            ))}
          </ul>
          <button className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Start Full Mock
          </button>
        </article>
      </section>
    </PortalShell>
  );
}
