import Image from "next/image";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams.next || "/";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0f1816] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, #26d9c0 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, #26d9c0 0%, transparent 40%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/20">
            <Image
              src="/logo.png"
              alt="Law and Bar"
              width={52}
              height={52}
              className="size-[52px] object-contain"
              priority
            />
          </div>
          <p className="font-[family-name:var(--font-playfair)] text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
            Law &amp; Bar
          </p>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/50">
            SQE study portal
          </p>
        </div>

        <main className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/25 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-[#121f1d] sm:text-[1.35rem]">
            Sign in
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#121f1d]/65">
            Use the same student email and password as the main Law &amp; Bar website. We match your account to
            SQE bundle orders, or you can activate with an administrator-generated access code when prompted.
          </p>
          <LoginForm nextPath={nextPath} />
        </main>

        <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
          Protected access. Unauthorized use may violate our terms of service.
        </p>
      </div>
    </div>
  );
}
