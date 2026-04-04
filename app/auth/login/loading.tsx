import Image from "next/image";

export default function LoginLoading() {
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
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/20">
          <Image src="/logo.png" alt="" width={52} height={52} className="size-[52px] object-contain" priority />
        </div>
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#26d9c0]"
          role="status"
          aria-label="Loading"
        />
        <p className="mt-5 text-sm font-medium text-white/90">Loading sign-in</p>
        <p className="mt-1 text-xs text-white/45">Preparing secure session…</p>
      </div>
    </div>
  );
}
