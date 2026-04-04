import PortalShell from "./portal-shell";
import SubjectsGridSkeleton from "./subjects-grid-skeleton";

export default function FlkTrackPageLoading({ trackLabel }: { trackLabel: "FLK 1" | "FLK 2" }) {
  return (
    <PortalShell title="" subtitle="" hideHeader>
      <div role="status" aria-live="polite" className="sr-only">
        Loading {trackLabel} subjects
      </div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#26d9c0]/15 text-[#0d4a42]">
          <div className="size-6 animate-pulse rounded-md bg-[#26d9c0]/30" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3 pt-0.5">
          <div className="h-9 w-36 animate-pulse rounded-lg bg-[#121f1d]/[0.1] sm:h-11 sm:w-44" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-[#121f1d]/[0.07]" />
          <div className="h-4 w-[85%] max-w-md animate-pulse rounded bg-[#121f1d]/[0.05]" />
        </div>
      </header>
      <SubjectsGridSkeleton />
    </PortalShell>
  );
}
