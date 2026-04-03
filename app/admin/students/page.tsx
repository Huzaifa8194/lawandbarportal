"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import FormSection from "@/app/components/admin/form-section";
import ToastInline from "@/app/components/admin/toast-inline";
import { adminApi } from "@/lib/services/admin-api";
import type { AccessCode, UserProfile } from "@/lib/types/admin";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const load = async () => {
    const [studentsResp, codesResp] = await Promise.all([
      adminApi.listStudents(),
      adminApi.listAccessCodes(),
    ]);
    setStudents(studentsResp as UserProfile[]);
    setCodes(codesResp as AccessCode[]);
  };

  useEffect(() => {
    load().catch(() => setFeedback({ type: "error", message: "Failed to load admin data." }));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (item) =>
        item.email?.toLowerCase().includes(q) ||
        item.fullName?.toLowerCase().includes(q) ||
        item.uid.toLowerCase().includes(q),
    );
  }, [query, students]);

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Student Accounts</h3>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email, name, or UID"
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 space-y-3">
              {filtered.map((student) => {
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
              {!filtered.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  No students matched your search.
                </p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Access Codes</h3>
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
            <div className="mt-4 space-y-2">
              {codes.slice(0, 8).map((code) => (
                <div key={code.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="font-mono text-sm">{code.code}</p>
                  <p className="text-xs text-slate-500">
                    {code.active ? "Active" : "Inactive"} {code.email ? `• ${code.email}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}
