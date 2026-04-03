import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/subjects", label: "Subjects" },
  { href: "/mocks", label: "Mock Exams" },
  { href: "/progress", label: "Progress" },
  { href: "/search", label: "Search" },
  { href: "/admin", label: "Admin" },
];

export default function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Law & Bar
          </p>
          <h1 className="mt-1 text-lg font-semibold">SQE Study Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Student Learning Area</p>
          <nav className="mt-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
