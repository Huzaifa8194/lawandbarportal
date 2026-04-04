"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { AccessCode, StudentAccessDebugResponse, UserProfile } from "@/lib/types/admin";

function ExplanationLine({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <p className="text-sm leading-relaxed text-slate-700">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80">
      <p className="border-b border-slate-200 bg-slate-100/80 px-3 py-2 text-xs font-semibold text-slate-700">{title}</p>
      <pre className="max-h-64 overflow-auto p-3 text-xs leading-relaxed text-slate-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function StudentRowSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-4" aria-hidden>
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="h-6 w-28 animate-pulse rounded-md bg-slate-100" />
        <div className="h-6 w-24 animate-pulse rounded-md bg-slate-100" />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

function CodeRowSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-slate-200 font-mono" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
    </div>
  );
}

type BundleFilter = "all" | "purchased" | "none";
type AccessFilter = "all" | "on" | "off";
type SortKey = "name_asc" | "name_desc" | "email_asc" | "email_desc" | "created_desc";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [query, setQuery] = useState("");
  const [bundleFilter, setBundleFilter] = useState<BundleFilter>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name_asc");
  const [codeQuery, setCodeQuery] = useState("");
  const [codeStatus, setCodeStatus] = useState<"all" | "active" | "inactive">("all");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [debugStudent, setDebugStudent] = useState<UserProfile | null>(null);
  const [debugData, setDebugData] = useState<StudentAccessDebugResponse | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [accessTogglingUid, setAccessTogglingUid] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [codesLoadError, setCodesLoadError] = useState<string | null>(null);

  const load = async (opts?: { isInitial?: boolean }) => {
    const isInitial = opts?.isInitial ?? false;
    if (isInitial) setInitialLoading(true);
    else setListRefreshing(true);
    try {
      const [studentsResult, codesResult] = await Promise.allSettled([
        adminApi.listStudents(),
        adminApi.listAccessCodes(),
      ]);

      if (studentsResult.status === "fulfilled") {
        setStudents(studentsResult.value as UserProfile[]);
      } else {
        const msg =
          studentsResult.reason instanceof Error
            ? studentsResult.reason.message
            : "Failed to load students.";
        setFeedback({ type: "error", message: msg });
      }

      if (codesResult.status === "fulfilled") {
        setCodes(codesResult.value as AccessCode[]);
        setCodesLoadError(null);
      } else {
        const msg =
          codesResult.reason instanceof Error ? codesResult.reason.message : "Failed to load access codes.";
        setCodesLoadError(msg);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load admin data." });
    } finally {
      if (isInitial) setInitialLoading(false);
      else setListRefreshing(false);
    }
  };

  useEffect(() => {
    load({ isInitial: true }).catch(() => setFeedback({ type: "error", message: "Failed to load admin data." }));
  }, []);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students;

    if (q) {
      list = list.filter(
        (item) =>
          item.email?.toLowerCase().includes(q) ||
          item.fullName?.toLowerCase().includes(q) ||
          item.uid.toLowerCase().includes(q),
      );
    }

    if (bundleFilter === "purchased") {
      list = list.filter((item) => item.sqeBundlePurchased === true);
    } else if (bundleFilter === "none") {
      list = list.filter((item) => item.sqeBundlePurchased !== true);
    }

    if (accessFilter === "on") {
      list = list.filter((item) => item.accessEnabled === true);
    } else if (accessFilter === "off") {
      list = list.filter((item) => item.accessEnabled !== true);
    }

    const sorted = [...list].sort((a, b) => {
      const nameA = (a.fullName || a.email || "").toLowerCase();
      const nameB = (b.fullName || b.email || "").toLowerCase();
      const emailA = (a.email || "").toLowerCase();
      const emailB = (b.email || "").toLowerCase();
      switch (sortKey) {
        case "name_desc":
          return nameB.localeCompare(nameA);
        case "email_asc":
          return emailA.localeCompare(emailB);
        case "email_desc":
          return emailB.localeCompare(emailA);
        case "created_desc": {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tb - ta;
        }
        case "name_asc":
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return sorted;
  }, [students, query, bundleFilter, accessFilter, sortKey]);

  const filteredCodes = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    let list = codes;
    if (codeStatus === "active") list = list.filter((c) => c.active);
    else if (codeStatus === "inactive") list = list.filter((c) => !c.active);
    if (q) {
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.uid && c.uid.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [codes, codeQuery, codeStatus]);

  const filtersActive =
    query.trim() !== "" ||
    bundleFilter !== "all" ||
    accessFilter !== "all" ||
    sortKey !== "name_asc" ||
    codeQuery.trim() !== "" ||
    codeStatus !== "all";

  const clearFilters = () => {
    setQuery("");
    setBundleFilter("all");
    setAccessFilter("all");
    setSortKey("name_asc");
    setCodeQuery("");
    setCodeStatus("all");
  };

  const closeDebug = useCallback(() => {
    setDebugStudent(null);
    setDebugData(null);
    setDebugError(null);
    setDebugLoading(false);
  }, []);

  const openDebug = async (student: UserProfile) => {
    setDebugStudent(student);
    setDebugData(null);
    setDebugError(null);
    setDebugLoading(true);
    try {
      const data = await adminApi.getStudentAccessDebug(student.uid);
      setDebugData(data);
    } catch (e) {
      setDebugError(e instanceof Error ? e.message : "Failed to load debug data.");
    } finally {
      setDebugLoading(false);
    }
  };

  useEffect(() => {
    if (!debugStudent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDebug();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugStudent, closeDebug]);

  const toggleAccess = async (student: UserProfile, nextEnabled: boolean) => {
    if (nextEnabled && student.sqeBundlePurchased !== true && student.portalAccessViaCode !== true) {
      setFeedback({
        type: "error",
        message: "Enable access only for students with an SQE bundle purchase or a redeemed access code.",
      });
      return;
    }
    setAccessTogglingUid(student.uid);
    try {
      await adminApi.updateStudentAccess(student.uid, nextEnabled);
      await load();
      setFeedback({ type: "success", message: "Student access updated." });
      try {
        await adminApi.logAudit({
          action: nextEnabled ? "enable_access" : "disable_access",
          entity: "user",
          entityId: student.uid,
          details: student.email,
        });
      } catch {
        /* Audit is best-effort; Firestore access is already updated. */
      }
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Update failed" });
    } finally {
      setAccessTogglingUid(null);
    }
  };

  const onCreateCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingCode(true);
    try {
      await adminApi.createAccessCode({
        email: email || undefined,
        expiresAt: expiresAt || undefined,
      });
      setEmail("");
      setExpiresAt("");
      await load();
      setFeedback({ type: "success", message: "Access code generated." });
      try {
        await adminApi.logAudit({
          action: "create_access_code",
          entity: "access_code",
          details: email || "No email binding",
        });
      } catch {
        /* best-effort */
      }
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Creation failed" });
    } finally {
      setCreatingCode(false);
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Students & Access"
        subtitle="Manage account activation with safe, clear controls and searchable student records."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}

        <section className="relative grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {listRefreshing && !initialLoading ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-white/65 pt-28 backdrop-blur-[1px]"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-md">
                <Spinner className="size-4 text-indigo-600" />
                Updating…
              </div>
            </div>
          ) : null}

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Student Accounts</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {initialLoading ? (
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <Spinner className="size-3.5 text-slate-500" />
                      Loading students…
                    </span>
                  ) : (
                    <>
                      Showing {filteredStudents.length} of {students.length} · click a name for access / bundle
                      debug
                    </>
                  )}
                </p>
              </div>
              {filtersActive && !initialLoading ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear all filters
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email, name, or UID"
                disabled={initialLoading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
              />
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                  SQE bundle
                  <select
                    value={bundleFilter}
                    onChange={(e) => setBundleFilter(e.target.value as BundleFilter)}
                    disabled={initialLoading}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="all">All</option>
                    <option value="purchased">Purchased</option>
                    <option value="none">Not purchased</option>
                  </select>
                </label>
                <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                  Portal access
                  <select
                    value={accessFilter}
                    onChange={(e) => setAccessFilter(e.target.value as AccessFilter)}
                    disabled={initialLoading}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="all">All</option>
                    <option value="on">Enabled</option>
                    <option value="off">Disabled</option>
                  </select>
                </label>
                <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                  Sort
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    disabled={initialLoading}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="name_asc">Name A–Z</option>
                    <option value="name_desc">Name Z–A</option>
                    <option value="email_asc">Email A–Z</option>
                    <option value="email_desc">Email Z–A</option>
                    <option value="created_desc">Newest first (if dated)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {initialLoading ? (
                <>
                  <StudentRowSkeleton />
                  <StudentRowSkeleton />
                  <StudentRowSkeleton />
                  <StudentRowSkeleton />
                </>
              ) : (
                <>
                  {filteredStudents.map((student) => {
                    const sqeEligible = student.sqeBundlePurchased === true;
                    const codeEligible = student.portalAccessViaCode === true;
                    const eligible = sqeEligible || codeEligible;
                    const rawOpen = student.accessEnabledRaw !== false;
                    const enabled = eligible && rawOpen;
                    const toggling = accessTogglingUid === student.uid;
                    const disableToggle =
                      toggling || (!eligible && !enabled);
                    return (
                      <div key={student.uid} className="rounded-xl border border-slate-200 p-4">
                        <button
                          type="button"
                          onClick={() => openDebug(student)}
                          disabled={toggling}
                          className="text-left font-medium text-slate-900 underline decoration-dotted decoration-slate-400 underline-offset-2 hover:text-indigo-700 hover:decoration-indigo-400 disabled:opacity-50"
                        >
                          {student.fullName || "Unnamed Student"}
                        </button>
                        <p className="text-sm text-slate-600">{student.email}</p>
                        <p className="mt-1 text-xs text-slate-500">UID: {student.uid}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              sqeEligible ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {sqeEligible ? "SQE bundle purchased" : "No SQE bundle"}
                          </span>
                          {codeEligible ? (
                            <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-900">
                              Access code redeemed
                            </span>
                          ) : null}
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {enabled ? "Access enabled" : "Access disabled"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAccess(student, !enabled)}
                            disabled={disableToggle}
                            className="inline-flex min-h-[2.25rem] min-w-[7.5rem] items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {toggling ? <Spinner className="size-4 text-slate-600" /> : null}
                            {toggling ? "Saving…" : enabled ? "Disable access" : "Enable access"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!filteredStudents.length ? (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                      No students matched these filters.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Access Codes</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {initialLoading ? (
                    <span className="inline-flex items-center gap-2 text-slate-600">
                      <Spinner className="size-3.5 text-slate-500" />
                      Loading codes…
                    </span>
                  ) : (
                    <>Showing {filteredCodes.length} of {codes.length}</>
                  )}
                </p>
              </div>
            </div>

            {codesLoadError ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
                Access codes could not be refreshed: {codesLoadError}. Student list and access toggles still
                use the latest data.
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="Search code, email, or UID"
                disabled={initialLoading}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              <select
                value={codeStatus}
                onChange={(e) => setCodeStatus(e.target.value as "all" | "active" | "inactive")}
                disabled={initialLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <form className="mt-4 space-y-3" onSubmit={onCreateCode}>
              <FormSection
                title="Generate code"
                helper="Students sign in at the portal first; if no store bundle matches their email, they enter this code on the activation step. Optional email lock restricts redemption to one address; expiry is optional."
              >
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Optional: student@email.com"
                  disabled={creatingCode || initialLoading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                />
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={creatingCode || initialLoading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={creatingCode || initialLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingCode ? <Spinner className="size-4 text-white" /> : null}
                  {creatingCode ? "Generating…" : "Generate code"}
                </button>
              </FormSection>
            </form>
            <div className="mt-4 max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
              {initialLoading ? (
                <>
                  <CodeRowSkeleton />
                  <CodeRowSkeleton />
                  <CodeRowSkeleton />
                </>
              ) : (
                <>
                  {filteredCodes.map((code) => (
                    <div key={code.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="font-mono text-sm">{code.code}</p>
                      <p className="text-xs text-slate-500">
                        {code.active ? "Active" : "Inactive"}
                        {code.email ? ` • locked to ${code.email}` : " • any email (after sign-in)"}
                        {code.expiresAt ? ` • expires ${code.expiresAt}` : ""}
                        {code.usedAt ? ` • used ${code.usedAt}` : ""}
                        {code.uid ? ` • uid ${code.uid.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                  ))}
                  {!filteredCodes.length ? (
                    <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                      No codes match these filters.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </article>
        </section>

        {debugStudent ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-debug-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close"
              onClick={closeDebug}
            />
            <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 id="access-debug-title" className="text-lg font-semibold text-slate-900">
                    Access debug
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {debugStudent.fullName || "Unnamed"} · {debugStudent.email}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{debugStudent.uid}</p>
                </div>
                <button
                  type="button"
                  onClick={closeDebug}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {debugLoading ? (
                  <p className="text-sm text-slate-600">Loading Firestore data…</p>
                ) : debugError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{debugError}</p>
                ) : debugData ? (
                  <div className="space-y-5">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div
                        className={`rounded-xl border px-3 py-3 ${
                          debugData.summary.effectiveAccessEnabled
                            ? "border-green-300 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <p className="text-xs font-medium text-slate-600">Effective portal access</p>
                        <p className="mt-1 text-sm font-semibold">
                          {debugData.summary.effectiveAccessEnabled ? "Enabled" : "Disabled"}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-600">
                          Same as student list: <code className="rounded bg-white/80 px-0.5">(bundle || code)</code> and{" "}
                          <code className="rounded bg-white/80 px-0.5">accessEnabled !== false</code>
                        </p>
                      </div>
                      <div
                        className={`rounded-xl border px-3 py-3 ${
                          debugData.summary.sqeBundlePurchased
                            ? "border-indigo-200 bg-indigo-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-medium text-slate-600">SQE bundle (orders)</p>
                        <p className="mt-1 text-sm font-semibold">
                          {debugData.summary.sqeBundlePurchased ? "Found" : "Not found"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          IDs: {debugData.constants.sqeBundleBookIds.join(", ")}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl border px-3 py-3 ${
                          debugData.summary.portalAccessViaCode
                            ? "border-teal-200 bg-teal-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-medium text-slate-600">Access code (user doc)</p>
                        <p className="mt-1 text-sm font-semibold">
                          {debugData.summary.portalAccessViaCode ? "Redeemed" : "Not set"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          <code className="rounded bg-white/80 px-0.5">portalAccessViaCode</code> after student redeems
                          an admin code at login.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-xs font-medium text-slate-600">Raw user.accessEnabled</p>
                        <p className="mt-1 font-mono text-sm font-semibold">
                          {debugData.summary.rawAccessEnabled === null
                            ? "undefined"
                            : String(debugData.summary.rawAccessEnabled)}
                        </p>
                        {debugData.summary.accessExplicitlyFalse ? (
                          <p className="mt-1 text-[11px] font-medium text-red-700">Explicitly set to false</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-600">Not false → eligible if bundle or code</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Why</p>
                      <div className="mt-2 space-y-2">
                        {debugData.explanation.map((line, i) => (
                          <ExplanationLine key={i} text={line} />
                        ))}
                      </div>
                    </div>

                    {debugData.orderQueryErrors.length ? (
                      <div className="rounded-xl border border-red-200 bg-red-50/80 p-3">
                        <p className="text-xs font-semibold text-red-900">Order query errors</p>
                        <ul className="mt-1 list-inside list-disc text-sm text-red-800">
                          {debugData.orderQueryErrors.map((err, i) => (
                            <li key={i}>
                              {err.collection}: {err.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <JsonBlock title={`users/${debugData.uid} (full document)`} value={debugData.user} />

                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">
                        bookorders (Stripe) — where userId == normalized email
                      </p>
                      {debugData.orders.bookorders.length === 0 ? (
                        <p className="text-sm text-slate-600">No documents.</p>
                      ) : (
                        <div className="space-y-3">
                          {debugData.orders.bookorders.map((row) => (
                            <div key={row.id}>
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-slate-600">bookorders/{row.id}</span>
                                <span
                                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                                    row.matchesSqeBundle
                                      ? "bg-green-100 text-green-900"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {row.matchesSqeBundle ? "Counts toward bundle" : "Does not count"}
                                </span>
                              </div>
                              {row.matchReasons.map((r, j) => (
                                <p key={j} className="text-xs text-slate-600">
                                  {r}
                                </p>
                              ))}
                              <JsonBlock title="Document" value={row.data} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700">
                        bookOrders (PayPal) — where userEmail == normalized email
                      </p>
                      {debugData.orders.bookOrders.length === 0 ? (
                        <p className="text-sm text-slate-600">No documents.</p>
                      ) : (
                        <div className="space-y-3">
                          {debugData.orders.bookOrders.map((row) => (
                            <div key={row.id}>
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-slate-600">bookOrders/{row.id}</span>
                                <span
                                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                                    row.matchesSqeBundle
                                      ? "bg-green-100 text-green-900"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {row.matchesSqeBundle ? "Counts toward bundle" : "Does not count"}
                                </span>
                              </div>
                              {row.matchReasons.map((r, j) => (
                                <p key={j} className="text-xs text-slate-600">
                                  {r}
                                </p>
                              ))}
                              <JsonBlock title="Document" value={row.data} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </AdminShell>
    </AdminGuard>
  );
}
