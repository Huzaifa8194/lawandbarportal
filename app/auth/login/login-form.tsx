"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalAccessDeniedError, useAuth } from "@/app/context/auth-context";

const DEFAULT_DENIED =
  "You do not have permission to use this portal. If you have already purchased the SQE bundle but access has not been enabled, please contact support.";

function messageForDeniedReason(reason?: string) {
  if (reason === "admin_disabled") {
    return "Your portal access has been disabled. Please contact support if you need help.";
  }
  if (reason === "no_user") {
    return "We could not find your account profile. Please contact support.";
  }
  return DEFAULT_DENIED;
}

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { signIn, signOut, user, accessEnabled, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signIn(email, password);
      const safePath = nextPath.startsWith("/") ? nextPath : "/";
      router.push(safePath || "/");
    } catch (e) {
      if (e instanceof PortalAccessDeniedError) {
        setError(messageForDeniedReason(e.reason));
      } else {
        setError("Login failed. Check your credentials and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      {!authLoading && user && !accessEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <p>
            You are signed in, but this account does not have portal access. Sign out to use a different
            account, or contact support if you purchased the SQE bundle and still need access enabled.
          </p>
          <button
            type="button"
            onClick={() => signOut().catch(() => undefined)}
            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100/80"
          >
            Sign out
          </button>
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring"
        />
      </div>
      {error ? <p className="text-sm leading-relaxed text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
