import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams.next || "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Law & Bar
        </p>
        <h1 className="mt-1 text-2xl font-semibold">SQE Portal Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the same student credentials as the main website.
        </p>
        <LoginForm nextPath={nextPath} />
      </main>
    </div>
  );
}
