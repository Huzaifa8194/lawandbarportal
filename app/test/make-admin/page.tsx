"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export default function MakeAdminTestPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const makeCurrentUserAdmin = async () => {
    try {
      setLoading(true);
      setMessage("");

      const user = auth.currentUser;
      if (!user) {
        setMessage("You must be logged in first.");
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/test/make-me-admin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update admin role.");
      }

      setMessage("Success. Your account is now marked as admin. Refresh the app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Test: Make Current User Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          This test action sets <code>isAdmin=true</code> for your logged-in user.
        </p>
        <button
          onClick={makeCurrentUserAdmin}
          disabled={loading}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Updating..." : "Make me admin"}
        </button>
        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </main>
    </div>
  );
}
