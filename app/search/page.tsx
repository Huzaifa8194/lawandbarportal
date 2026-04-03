import PortalShell from "../components/portal-shell";
import { mcqQuestions, subjectResources } from "../lib/portal-data";

export default function SearchPage() {
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
          placeholder="Search subjects, books, audios, mock questions..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
        />
        <p className="mt-2 text-xs text-slate-500">
          Connect this input to Firestore queries / full-text indexing in the next step.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Books & Audio</h3>
          <div className="mt-4 space-y-2">
            {subjectResources.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.subject}</p>
                <p className="text-xs text-slate-600">
                  {item.bookTitle} | {item.audioTitle}
                </p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">MCQs</h3>
          <div className="mt-4 space-y-2">
            {mcqQuestions.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium">{item.subject}</p>
                <p className="text-xs text-slate-600">{item.question}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PortalShell>
  );
}
