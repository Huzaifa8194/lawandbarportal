export default function SubjectsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="grid gap-4 sm:gap-5 md:grid-cols-2" aria-busy="true" aria-label="Loading subjects">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border border-[#121f1d]/8 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-6 w-[72%] max-w-[280px] animate-pulse rounded-md bg-[#121f1d]/[0.08]" />
            <div className="mt-1 size-5 shrink-0 animate-pulse rounded bg-[#121f1d]/[0.06]" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded bg-[#121f1d]/[0.06]" />
            <div className="h-3.5 w-[92%] animate-pulse rounded bg-[#121f1d]/[0.06]" />
            <div className="h-3.5 w-[55%] animate-pulse rounded bg-[#121f1d]/[0.05]" />
          </div>
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="h-3.5 w-20 animate-pulse rounded bg-[#121f1d]/[0.05]" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-[#121f1d]/[0.05]" />
          </div>
        </div>
      ))}
      <p className="sr-only">Loading subject list…</p>
    </section>
  );
}
