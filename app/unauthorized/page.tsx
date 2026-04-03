import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <main className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-slate-600">
          This area is for administrators only. If you think this is a mistake, contact support.
        </p>
        <div className="mt-5 flex gap-3">
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
