"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./logout-button";
import { useAuth } from "../context/auth-context";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/subjects/flk1", label: "FLK1" },
  { href: "/subjects/flk2", label: "FLK2" },
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
  const { isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const links = navItems.filter((item) => (item.href === "/admin" ? isAdmin : true));

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
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Tip: Start from Subjects to study with PDF + audio together, then attempt mocks.
          </div>
          <p className="mt-5 text-xs text-slate-500">
            {loading ? "Checking permissions..." : isAdmin ? "Admin account" : "Student account"}
          </p>
        </aside>
        <main className="space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
              </div>
              <LogoutButton />
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
