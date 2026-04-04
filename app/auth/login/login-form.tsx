"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalAccessDeniedError, useAuth } from "@/app/context/auth-context";

function messageForDeniedReason(reason?: string) {
  if (reason === "admin_disabled") {
    return {
      title: "Portal access suspended",
      body: "Your portal access has been disabled by an administrator. If you believe this is a mistake, contact support with your account email.",
    };
  }
  if (reason === "no_user") {
    return {
      title: "Account not provisioned",
      body: "We could not find a portal profile for this sign-in. If you recently registered, try again later or contact support to link your purchase.",
    };
  }
  if (reason === "no_bundle") {
    return {
      title: "SQE bundle required",
      body: "Portal access is included with the SQE study bundle. Sign in with the email used at purchase, or contact support if you already bought the bundle under a different address.",
    };
  }
  if (reason === "error") {
    return {
      title: "Could not verify access",
      body: "We could not confirm your portal permissions. Check your connection, try again in a moment, or contact support if this keeps happening.",
    };
  }
  return {
    title: "Access not granted",
    body: "You do not have permission to use this portal. If you purchased the SQE bundle and expected access, contact support with your order details.",
  };
}

function messageForFirebaseAuth(code: string | undefined) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return {
        title: "Sign-in failed",
        body: "The email or password is incorrect, or no account exists for this address. Check your details or use the password reset on the main website.",
      };
    case "auth/too-many-requests":
      return {
        title: "Too many attempts",
        body: "Sign-in was temporarily limited for security. Wait a few minutes before trying again.",
      };
    case "auth/network-request-failed":
      return {
        title: "Connection problem",
        body: "We could not reach the authentication service. Check your network and try again.",
      };
    case "auth/user-disabled":
      return {
        title: "Account disabled",
        body: "This account has been disabled. Contact support for assistance.",
      };
    default:
      return {
        title: "Sign-in could not complete",
        body: "Something went wrong during sign-in. Try again or contact support if the problem continues.",
      };
  }
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

function AlertBlock({
  variant,
  title,
  body,
  role = "alert",
}: {
  variant: "danger" | "warning" | "neutral";
  title: string;
  body: string;
  role?: "alert" | "status";
}) {
  const styles =
    variant === "danger"
      ? "border-red-200/80 bg-red-50 text-red-950"
      : variant === "warning"
        ? "border-amber-200/90 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div
      role={role}
      className={`rounded-xl border p-4 text-sm leading-relaxed shadow-sm ${styles}`}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {variant === "danger" ? (
            <svg className="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : variant === "warning" ? (
            <svg className="size-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : (
            <svg className="size-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed opacity-90">{body}</p>
        </div>
      </div>
    </div>
  );
}

function SessionLoading() {
  return (
    <div
      className="mt-8 flex flex-col items-center justify-center py-10"
      role="status"
      aria-live="polite"
      aria-label="Verifying session"
    >
      <Spinner className="size-9 text-[#26d9c0]" />
      <p className="mt-4 text-sm font-medium text-[#121f1d]">Verifying your session</p>
      <p className="mt-1 max-w-[280px] text-center text-xs leading-relaxed text-[#121f1d]/50">
        Checking authentication and portal access. This usually takes only a moment.
      </p>
      <div className="mt-8 w-full space-y-3" aria-hidden>
        <div className="h-10 animate-pulse rounded-xl bg-[#121f1d]/[0.06]" />
        <div className="h-10 animate-pulse rounded-xl bg-[#121f1d]/[0.06]" />
        <div className="h-11 animate-pulse rounded-xl bg-[#121f1d]/[0.08]" />
      </div>
    </div>
  );
}

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { signIn, signOut, user, accessEnabled, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
      const safePath = nextPath.startsWith("/") ? nextPath : "/";
      router.push(safePath || "/");
    } catch (e) {
      if (e instanceof PortalAccessDeniedError) {
        setError(messageForDeniedReason(e.reason));
      } else {
        const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
        setError(messageForFirebaseAuth(code));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <SessionLoading />;
  }

  return (
    <div className="mt-6 space-y-5">
      {user && !accessEnabled ? (
        <AlertBlock
          variant="warning"
          title="Signed in without portal access"
          body="You are authenticated, but this account is not enabled for the study portal. Sign out to use a different account, or contact support if you expected access."
        />
      ) : null}

      {error ? <AlertBlock variant="danger" title={error.title} body={error.body} /> : null}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-[#121f1d]">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={submitting}
            className="mt-1.5 w-full rounded-xl border border-[#121f1d]/15 bg-white px-3.5 py-2.5 text-sm text-[#121f1d] outline-none ring-[#26d9c0]/40 transition placeholder:text-[#121f1d]/35 focus:border-[#26d9c0]/50 focus:ring-2 disabled:opacity-60"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-[#121f1d]">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
            className="mt-1.5 w-full rounded-xl border border-[#121f1d]/15 bg-white px-3.5 py-2.5 text-sm text-[#121f1d] outline-none ring-[#26d9c0]/40 transition placeholder:text-[#121f1d]/35 focus:border-[#26d9c0]/50 focus:ring-2 disabled:opacity-60"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#121f1d] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2e2a] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {submitting ? (
            <>
              <Spinner className="size-4 text-white" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {user && !accessEnabled ? (
        <button
          type="button"
          onClick={() => signOut().catch(() => undefined)}
          className="w-full rounded-xl border border-[#121f1d]/12 bg-[#121f1d]/[0.03] px-4 py-2.5 text-sm font-medium text-[#121f1d] transition hover:bg-[#121f1d]/[0.06]"
        >
          Sign out and use another account
        </button>
      ) : null}
    </div>
  );
}
