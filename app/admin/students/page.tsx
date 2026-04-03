"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { AccessCode, UserProfile } from "@/lib/types/admin";

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

  const load = async () => {
    setFeedback(null);
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
    } else if (studentsResult.status === "fulfilled") {
      const msg =
        codesResult.reason instanceof Error ? codesResult.reason.message : "Failed to load access codes.";
      setFeedback({ type: "error", message: `Students loaded; access codes failed: ${msg}` });
    }
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load admin data." }));
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

  const toggleAccess = async (student: UserProfile, nextEnabled: boolean) => {
    try {
      // Only SQE-bundle buyers are allowed to have access enabled.
      if (nextEnabled && student.sqeBundlePurchased !== true) {
        setFeedback({ type: "error", message: "This student hasn't purchased the SQE bundle yet." });
        return;
      }
      await adminApi.updateStudentAccess(student.uid, nextEnabled);
      await adminApi.logAudit({
        action: nextEnabled ? "enable_access" : "disable_access",
        entity: "user",
        entityId: student.uid,
        details: student.email,
      });
      await load();
      setFeedback({ type: "success", message: "Student access updated." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Update failed" });
    }
  };

  const onCreateCode = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.createAccessCode({
        email: email || undefined,
        expiresAt: expiresAt || undefined,
      });
      await adminApi.logAudit({
        action: "create_access_code",
        entity: "access_code",
        details: email || "No email binding",
      });
      setEmail("");
      setExpiresAt("");
      await load();
      setFeedback({ type: "success", message: "Access code generated." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Creation failed" });
    }
  };

  return (
    <AdminGuard>
      <AdminShell
        title="Students & Access"
        subtitle="Manage account activation with safe, clear controls and searchable student records."
      >
        {feedback ? <ToastInline type={feedback.type} message={feedback.message} /> : null}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Student Accounts</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredStudents.length} of {students.length}
                </p>
              </div>
              {filtersActive ? (
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                  SQE bundle
                  <select
                    value={bundleFilter}
                    onChange={(e) => setBundleFilter(e.target.value as BundleFilter)}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900"
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
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900"
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
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-normal text-slate-900"
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
              {filteredStudents.map((student) => {
                const sqeEligible = student.sqeBundlePurchased === true;
                const enabled = sqeEligible && student.accessEnabled !== false;
                return (
                  <div
                    key={student.uid}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="font-medium">{student.fullName || "Unnamed Student"}</p>
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
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {enabled ? "Access enabled" : "Access disabled"}
                      </span>
                      <button
                        onClick={() => toggleAccess(student, !enabled)}
                        disabled={!sqeEligible && enabled === false}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      >
                        {enabled ? "Disable access" : "Enable access"}
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
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Access Codes</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredCodes.length} of {codes.length}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="Search code, email, or UID"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={codeStatus}
                onChange={(e) => setCodeStatus(e.target.value as "all" | "active" | "inactive")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <form className="mt-4 space-y-3" onSubmit={onCreateCode}>
              <FormSection
                title="Generate code"
                helper="Optional email lock makes code valid only for one student email."
              >
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Optional: student@email.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Generate code
                </button>
              </FormSection>
            </form>
            <div className="mt-4 max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
              {filteredCodes.map((code) => (
                <div key={code.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="font-mono text-sm">{code.code}</p>
                  <p className="text-xs text-slate-500">
                    {code.active ? "Active" : "Inactive"} {code.email ? `• ${code.email}` : ""}
                  </p>
                </div>
              ))}
              {!filteredCodes.length ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                  No codes match these filters.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
