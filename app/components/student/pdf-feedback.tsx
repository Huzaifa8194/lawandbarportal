"use client";

import type { PdfLoadError } from "@/lib/pdf-errors";

export default function PdfFeedback({ error, message, onRetry, fileUrl }: {
  error?: PdfLoadError | null;
  message?: string;
  onRetry?: () => void;
  fileUrl?: string;
}) {
  return <div className="flex min-h-64 flex-1 items-center justify-center p-6" role={error ? "alert" : "status"} aria-live="polite">
    <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#101c1a] p-6 text-sm text-white/85">
      <h2 className="mb-2 text-base font-semibold text-white">{error ? "Unable to open this PDF" : "Opening your book"}</h2>
      <p>{error?.message || message || "Starting the PDF viewer…"}</p>
      {error && <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all text-xs text-white/55">
        <dt>Stage</dt><dd>{error.stage}</dd>
        <dt>Error</dt><dd>{error.code}{error.status ? ` · HTTP ${error.status}` : ""}</dd>
        {error.requestId && <><dt>Reference</dt><dd className="select-all">{error.requestId}</dd></>}
      </dl>}
      {(onRetry || fileUrl) && <div className="mt-4 flex flex-wrap gap-3">
        {onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-[#26d9c0] px-4 py-2 font-semibold text-[#071513] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Retry</button>}
        {fileUrl && <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/25 px-4 py-2 text-white">Open downloaded PDF</a>}
      </div>}
      {error && <p className="mt-4 text-xs text-white/45">If this continues, send support the error and reference shown above.</p>}
    </div>
  </div>;
}
