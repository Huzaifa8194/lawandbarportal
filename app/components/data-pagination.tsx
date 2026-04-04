"use client";

import { useMemo } from "react";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type DataPaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Shown in aria-label for the nav landmark */
  label: string;
  className?: string;
  /** When false, page size dropdown is hidden (fixed page size) */
  showPageSize?: boolean;
  pageSizeOptions?: readonly number[];
  /** `portal` matches Progress; `neutral` matches Search (slate) */
  variant?: "portal" | "neutral";
};

function buildPageWindow(current: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(totalPages);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= totalPages) set.add(i);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function DataPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label,
  className = "",
  showPageSize = true,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  variant = "portal",
}: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  const windowItems = useMemo(() => buildPageWindow(safePage, totalPages), [safePage, totalPages]);

  const muted = variant === "neutral" ? "text-slate-500" : "text-[#121f1d]/50";
  const labelMuted = variant === "neutral" ? "text-slate-600" : "text-[#121f1d]/60";
  const labelStrong = variant === "neutral" ? "text-slate-900" : "text-[#121f1d]";
  const gapColor = variant === "neutral" ? "text-slate-400" : "text-[#121f1d]/35";

  if (total === 0) {
    return (
      <p className={`text-sm ${muted} ${className}`} role="status">
        No results to show.
      </p>
    );
  }

  const btnBase =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40";
  const btnIdle =
    variant === "neutral"
      ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      : "border-[#121f1d]/15 bg-white text-[#121f1d] hover:border-[#26d9c0]/50 hover:bg-[#f8f9fa]";
  const btnActive =
    variant === "neutral"
      ? "border-slate-800 bg-slate-100 text-slate-900"
      : "border-[#26d9c0] bg-[#26d9c0]/15 text-[#0d4a42]";

  return (
    <nav
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label={label}
    >
      <p className={`text-sm tabular-nums ${labelMuted}`}>
        Showing <span className={`font-medium ${labelStrong}`}>{start}</span>–
        <span className={`font-medium ${labelStrong}`}>{end}</span> of{" "}
        <span className={`font-medium ${labelStrong}`}>{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showPageSize ? (
          <label className={`flex items-center gap-2 text-sm ${variant === "neutral" ? "text-slate-600" : "text-[#121f1d]/70"}`}>
            <span className="whitespace-nowrap">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={
                variant === "neutral"
                  ? "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  : "rounded-lg border border-[#121f1d]/15 bg-white px-2 py-1.5 text-sm text-[#121f1d] outline-none focus:ring-2 focus:ring-[#26d9c0]/40"
              }
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={`${btnBase} ${btnIdle} px-2.5`}
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            First
          </button>
          <button
            type="button"
            className={`${btnBase} ${btnIdle} px-2.5`}
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            Prev
          </button>

          {windowItems.map((item, idx) =>
            item === "gap" ? (
              <span key={`gap-${idx}`} className={`px-1 ${gapColor}`} aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`${btnBase} ${item === safePage ? btnActive : btnIdle}`}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === safePage ? "page" : undefined}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className={`${btnBase} ${btnIdle} px-2.5`}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
          </button>
          <button
            type="button"
            className={`${btnBase} ${btnIdle} px-2.5`}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            Last
          </button>
        </div>
      </div>
    </nav>
  );
}

export { PAGE_SIZE_OPTIONS };
