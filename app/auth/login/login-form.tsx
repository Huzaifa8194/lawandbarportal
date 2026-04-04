"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PortalAccessDeniedError,
  RedeemAccessCodeError,
  useAuth,
} from "@/app/context/auth-context";

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
      body: "Portal access is included with the SQE study bundle, or an administrator can issue an access code. Sign in with the email used at purchase, or use a code after signing in.",
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

function messageForRedeemError(code: string) {
  switch (code) {
    case "INVALID_CODE":
    case "INVALID_FORMAT":
      return {
        title: "Code not accepted",
        body: "That code was not recognized. Copy it exactly (for example LB-XXXXXXXX) or ask your administrator for a new code.",
      };
    case "EXPIRED":
      return {
        title: "Code expired",
        body: "This access code is past its valid date. Contact support or your administrator for a replacement.",
      };
    case "EMAIL_LOCK":
      return {
        title: "Wrong account for this code",
        body: "This code is restricted to a specific email address. Sign out and sign in with the email your administrator used when generating the code.",
      };
    case "ALREADY_USED":
      return {
        title: "Code already used",
        body: "Each code can only be used once. If you already redeemed it on another account, sign in with that account or request a new code.",
      };
    case "ADMIN_DISABLED":
      return {
        title: "Access disabled",
        body: "Portal access has been turned off for this account. Contact support to have it re-enabled.",
      };
    case "NO_USER_DOC":
      return {
        title: "Profile not ready",
        body: "Your account is not fully set up in our system yet. Contact support so we can link your profile.",
      };
    case "NOT_SIGNED_IN":
      return {
        title: "Session required",
        body: "Sign in again, then enter your access code.",
      };
    default:
      return {
        title: "Activation failed",
        body: "We could not apply this code. Try again or contact support with the code reference (if shown in your email).",
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
  variant: "danger" | "warning" | "neutral" | "success";
  title: string;
  body: string;
  role?: "alert" | "status";
}) {
  const styles =
    variant === "danger"
      ? "border-red-200/80 bg-red-50 text-red-950"
      : variant === "warning"
        ? "border-amber-200/90 bg-amber-50 text-amber-950"
        : variant === "success"
          ? "border-emerald-200/90 bg-emerald-50 text-emerald-950"
          : "border-slate-200 bg-slate-50 text-slate-900";

  const icon =
    variant === "danger" ? (
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
    ) : variant === "success" ? (
      <svg className="size-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
    );

  return (
    <div
      role={role}
      className={`rounded-xl border p-4 text-sm leading-relaxed shadow-sm ${styles}`}
    >
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon}
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
  const { signIn, signOut, redeemAccessCode, user, accessEnabled, portalAccessReason, loading: authLoading } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [redeemError, setRedeemError] = useState<{ title: string; body: string } | null>(null);

  const showCodeActivation =
    Boolean(user) && !accessEnabled && portalAccessReason === "no_bundle";
  const showOtherAccessBlock =
    Boolean(user) && !accessEnabled && portalAccessReason !== "no_bundle" && portalAccessReason !== undefined;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setRedeemError(null);

    try {
      const result = await signIn(email, password);
      if (result === "ok") {
        const safePath = nextPath.startsWith("/") ? nextPath : "/";
        router.push(safePath || "/");
      }
    } catch (e) {
      if (e instanceof PortalAccessDeniedError) {
        setError(messageForDeniedReason(e.reason));
      } else {
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? String((e as { code: unknown }).code)
            : undefined;
        setError(messageForFirebaseAuth(code));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onRedeem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRedeeming(true);
    setRedeemError(null);
    try {
      await redeemAccessCode(accessCode);
      const safePath = nextPath.startsWith("/") ? nextPath : "/";
      router.push(safePath || "/");
    } catch (e) {
      if (e instanceof RedeemAccessCodeError) {
        const mapped = messageForRedeemError(e.code);
        setRedeemError(mapped);
      } else {
        setRedeemError(messageForRedeemError("UNKNOWN"));
      }
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading) {
    return <SessionLoading />;
  }

  return (
    <div className="mt-6 space-y-5">
      {showOtherAccessBlock ? (
        <AlertBlock
          variant="warning"
          title="Signed in without portal access"
          body={
            portalAccessReason === "admin_disabled"
              ? "Access for this account has been disabled. Sign out to try another account, or contact support."
              : "You are signed in, but this account cannot open the study portal yet. Sign out to try a different account or contact support."
          }
        />
      ) : null}

      {error ? <AlertBlock variant="danger" title={error.title} body={error.body} /> : null}

      {showCodeActivation ? (
        <div className="space-y-5">
          <AlertBlock
            variant="success"
            role="status"
            title="Signed in — activation required"
            body={`You are signed in as ${user?.email ?? "your account"}. No matching SQE bundle order was found for this email. If Law & Bar issued you an access code, enter it below to unlock the portal. Codes are single-use and may be locked to this email or an expiry date.`}
          />

          {redeemError ? (
            <AlertBlock variant="danger" title={redeemError.title} body={redeemError.body} />
          ) : null}

          <form className="space-y-4" onSubmit={onRedeem}>
            <div>
              <label htmlFor="access-code" className="text-sm font-medium text-[#121f1d]">
                Access code
              </label>
              <input
                id="access-code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                disabled={redeeming}
                placeholder="LB-XXXXXXXX"
                className="mt-1.5 w-full rounded-xl border border-[#121f1d]/15 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wide text-[#121f1d] outline-none ring-[#26d9c0]/40 transition placeholder:font-sans placeholder:tracking-normal placeholder:text-[#121f1d]/35 focus:border-[#26d9c0]/50 focus:ring-2 disabled:opacity-60"
              />
              <p className="mt-2 text-xs leading-relaxed text-[#121f1d]/50">
                Paste the code from your administrator. Email-locked codes only work for the matching sign-in
                address.
              </p>
            </div>
            <button
              type="submit"
              disabled={redeeming || !accessCode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#26d9c0] px-4 py-3 text-sm font-semibold text-[#121f1d] shadow-sm transition hover:bg-[#22c4ae] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {redeeming ? (
                <>
                  <Spinner className="size-4 text-[#121f1d]" />
                  Activating…
                </>
              ) : (
                "Activate portal access"
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setAccessCode("");
              setRedeemError(null);
              signOut().catch(() => undefined);
            }}
            className="w-full rounded-xl border border-[#121f1d]/12 bg-[#121f1d]/[0.03] px-4 py-2.5 text-sm font-medium text-[#121f1d] transition hover:bg-[#121f1d]/[0.06]"
          >
            Sign out and use another account
          </button>
        </div>
      ) : (
        <>
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

          <div className="rounded-xl border border-[#121f1d]/10 bg-[#121f1d]/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#121f1d]/55">
              Administrator access code
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#121f1d]/60">
              If you were given a code instead of (or before) a store purchase, sign in with your Law &amp; Bar
              account first. When no bundle is found for your email, you will be prompted to enter the code on
              the next step.
            </p>
          </div>
        </>
      )}

      {user && !accessEnabled && !showCodeActivation ? (
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
