"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./logout-button";
import { useAuth } from "../context/auth-context";
import StudentAssistant from "./student-assistant";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/subjects/flk1", label: "FLK 1" },
  { href: "/subjects/flk2", label: "FLK 2" },
  { href: "/mocks", label: "Mock Exams" },
  { href: "/progress", label: "Progress" },
  { href: "/admin", label: "Admin" },
];

function NavIcon({ href }: { href: string }) {
  if (href === "/") {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    );
  }
  if (href.includes("flk1")) {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  if (href.includes("flk2")) {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    );
  }
  if (href === "/mocks") {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    );
  }
  if (href === "/progress") {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (href === "/search") {
    return (
      <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  }
  return (
    <svg className="size-5 shrink-0 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PortalShell({
  title,
  subtitle,
  children,
  hideHeader = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  hideHeader?: boolean;
}) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = navItems.filter((item) => (item.href === "/admin" ? isAdmin : true));

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const displayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0]?.replace(/\./g, " ") ||
    "Student";

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-[#121f1d] text-white">
      <div className="border-b border-white/10 px-5 pb-5 pt-6">
        <Link href="/" className="flex items-start gap-3" onClick={() => setMobileOpen(false)}>
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
            <Image src="/logo.png" alt="" width={44} height={44} className="size-full object-contain p-1" priority />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-[family-name:var(--font-playfair)] text-lg font-semibold leading-tight tracking-tight text-white">
              Law &amp; Bar
            </p>
            <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/55">
              SQE Study Portal
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-[#26d9c0] text-[#121f1d] shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              <NavIcon href={item.href} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          {user?.email ? (
            <p className="mt-0.5 truncate text-xs text-white/55">{user.email}</p>
          ) : null}
          <div className="mt-3">
            <LogoutButton variant="sidebar" />
          </div>
        </div>
        {loading ? <p className="mt-2 px-1 text-xs text-white/45">Checking permissions…</p> : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#121f1d]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#121f1d]/10 bg-[#121f1d] px-4 py-3 safe-top safe-x md:hidden">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
            <Image src="/logo.png" alt="" width={36} height={36} className="size-full object-contain p-0.5" priority />
          </div>
          <span className="truncate font-[family-name:var(--font-playfair)] text-base font-semibold text-white">
            Law &amp; Bar
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-white/10 p-2 text-white ring-1 ring-white/15 transition hover:bg-white/15"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1600px] md:min-h-screen">
        <aside
          className={`fixed bottom-0 left-0 top-14 z-50 w-[min(100%,280px)] max-w-[280px] transform transition-transform duration-200 ease-out md:static md:top-auto md:z-0 md:flex md:h-auto md:min-h-screen md:w-[280px] md:max-w-none md:translate-x-0 md:shrink-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {sidebar}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 safe-bottom safe-x sm:px-6 lg:px-10 lg:py-8">
          {!hideHeader ? (
            <header className="mb-6 rounded-2xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-tight text-[#121f1d] sm:text-[1.65rem]">
                    {title}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[#121f1d]/65">{subtitle}</p>
                </div>
                <div className="hidden sm:block">
                  <LogoutButton />
                </div>
              </div>
            </header>
          ) : null}
          <div className="space-y-6">{children}</div>
        </main>
      </div>
      <StudentAssistant />
    </div>
  );
}
