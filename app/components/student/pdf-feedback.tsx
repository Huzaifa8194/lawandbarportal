"use client";

import type { PdfLoadError } from "@/lib/pdf-errors";

export default function PdfFeedback({ error, message, onRetry, fileUrl, progress }: {
  error?: PdfLoadError | null;
  message?: string;
  onRetry?: () => void;
  fileUrl?: string;
  progress?: { received: number; total?: number };
}) {
  const percent = progress?.total ? Math.min(100, Math.floor(progress.received / progress.total * 100)) : undefined;
  return <div className="flex min-h-64 flex-1 items-center justify-center p-6" role={error ? "alert" : "status"} aria-live="polite">
    <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#101c1a] p-6 text-sm text-white/85">
      <h2 className="mb-2 text-base font-semibold text-white">{error ? "Unable to open this PDF" : "Opening your book"}</h2>
      <p>{error?.message || message || "Starting the PDF viewer…"}</p>
      {!error && <div className="mt-4">
        <progress aria-label={progress ? "PDF download progress" : "Opening book"} max={100} value={percent} className="block h-2 w-full accent-[#8ed9c9]" />
        {progress && <p className="mt-2 text-xs tabular-nums text-white/65">
          {(progress.received / 1_048_576).toFixed(1)} MB{progress.total ? ` of ${(progress.total / 1_048_576).toFixed(1)} MB · ${percent}%` : " downloaded"}
        </p>}
      </div>}
      {(onRetry || fileUrl) && <div className="mt-4 flex flex-wrap gap-3">
        {onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-[#26d9c0] px-4 py-2 font-semibold text-[#071513] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Retry</button>}
        {fileUrl && <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/25 px-4 py-2 text-white">Open downloaded PDF</a>}
      </div>}
      {error?.requestId && <p className="mt-4 break-all text-xs text-white/55">Support reference <span className="select-all">{error.requestId}</span></p>}
    </div>
  </div>;
}
