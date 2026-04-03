import PortalShell from "../components/portal-shell";

const adminSections = [
  {
    title: "Students / Access",
    actions: [
      "Generate and manage access",
      "See activation status by email",
      "Disable or re-enable student access",
    ],
  },
  {
    title: "Books",
    actions: ["Upload PDF", "Assign FLK + subject", "Edit/delete and replace files"],
  },
  {
    title: "Audios",
    actions: [
      "Upload audio and set title",
      "Assign to FLK + subject",
      "Link audio to correct book",
    ],
  },
  {
    title: "MCQs and Mocks",
    actions: [
      "Create/edit/delete MCQs",
      "Set 5 options + correct answer + explanation",
      "Group questions into mock exams",
    ],
  },
];

export default function AdminPage() {
  return (
    <PortalShell
      title="Admin Panel"
      subtitle="Central management for students, books, audios, MCQs, and access control."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{section.title}</h3>
            <ul className="mt-4 space-y-2">
              {section.actions.map((action) => (
                <li key={action} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </PortalShell>
  );
}
