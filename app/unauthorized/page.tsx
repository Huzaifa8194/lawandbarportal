import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <main className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You do not have permission to view this area. Student content requires an SQE bundle purchase, a
          redeemed administrator access code, or enabled portal access. Administrators need an admin account.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          If you have a Law &amp; Bar access code, go to{" "}
          <Link
            href="/auth/login"
            className="font-medium text-slate-900 underline decoration-slate-400 underline-offset-2"
          >
            sign in
          </Link>
          , enter your credentials, then complete activation with your code when prompted.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Sign in again
          </Link>
        </div>
      </main>
    </div>
  );
}
