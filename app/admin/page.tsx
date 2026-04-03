import Link from "next/link";
import AdminGuard from "../components/admin/admin-guard";
import AdminShell from "../components/admin/admin-shell";

const adminSections = [
  { href: "/admin/students", title: "Students & Access", text: "Manage activation and access control." },
  { href: "/admin/subjects", title: "Subjects", text: "Control FLK structure and subject ordering." },
  { href: "/admin/books", title: "Books", text: "Upload and assign FLK subject PDFs." },
  { href: "/admin/audios", title: "Audios", text: "Upload audio and link to books." },
  { href: "/admin/mcqs", title: "MCQs", text: "Author 5-option questions with explanations." },
  { href: "/admin/mocks", title: "Mock Exams", text: "Group MCQs into exam and practice sets." },
];

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminShell
        title="Admin Overview"
        subtitle="Everything is organized in guided sections so non-technical team members can confidently manage student learning content."
      >
        <section className="grid gap-4 md:grid-cols-2">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{section.text}</p>
              <p className="mt-4 text-sm font-medium text-slate-900">Open module</p>
            </Link>
          ))}
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
