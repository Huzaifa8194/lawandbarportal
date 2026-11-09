import { PdfLoadError, describePdfError, pdfResponseError } from "@/lib/pdf-errors";

type Progress = { stage: "source" | "download"; attempt: number; received?: number; total?: number; transport?: "direct" | "proxy" };

function untilAborted<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

async function transfer(url: string, options: RequestInit, signal: AbortSignal, onProgress: (received: number, total?: number) => void) {
  const idle = new AbortController();
  const transferSignal = AbortSignal.any([signal, idle.signal]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resetDeadline = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle.abort(new PdfLoadError("The PDF download stopped receiving data. Please retry.", "PDF_DOWNLOAD_IDLE", "download", true)), 12_000);
  };
  resetDeadline();
  try {
    const response = await untilAborted(fetch(url, { ...options, signal: transferSignal, cache: "no-store" }), transferSignal);
    resetDeadline();
    return await untilAborted(readPdf(response, (received, total) => {
      if (transferSignal.aborted) return;
      resetDeadline();
      onProgress(received, total);
    }, transferSignal), transferSignal);
  } finally {
    clearTimeout(timer);
  }
}

async function readPdf(response: Response, progress: (received: number, total?: number) => void, signal: AbortSignal) {
  if (!response.ok) throw await pdfResponseError(response, "download");
  if (!response.body) throw new PdfLoadError("The server returned an empty PDF response.", "PDF_EMPTY", "download", true);
  const length = Number(response.headers.get("Content-Length"));
  const total = Number.isSafeInteger(length) && length > 0 && !response.headers.get("Content-Encoding") ? length : undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  progress(received, total);
  try {
    while (true) {
      const { done, value } = await untilAborted(reader.read(), signal);
      if (done) break;
      chunks.push(new Uint8Array(value));
      received += value.byteLength;
      progress(received, total);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (total && total !== received) throw new PdfLoadError("The PDF download ended before the whole file arrived. Please retry.", "PDF_DOWNLOAD_INCOMPLETE", "download", true);
  const blob = new Blob(chunks, { type: "application/pdf" });
  if (await blob.slice(0, 1024).text().then((text) => !text.includes("%PDF-"))) {
    throw new PdfLoadError("The stored file is not a valid PDF. Please ask support to replace this book's file.", "PDF_INVALID_FILE", "download");
  }
  return blob;
}

export async function downloadBookPdf(
  bookId: string,
  getToken: (refresh: boolean) => Promise<string>,
  signal: AbortSignal,
  onProgress: (progress: Progress) => void,
) {
  const endpoint = `/api/student/books/${encodeURIComponent(bookId)}/file`;
  const deadline = AbortSignal.timeout(120_000);
  const downloadSignal = AbortSignal.any([signal, deadline]);
  let lastError: PdfLoadError | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    downloadSignal.throwIfAborted();
    try {
      onProgress({ stage: "source", attempt });
      const lookupSignal = AbortSignal.any([downloadSignal, AbortSignal.timeout(18_000)]);
      const token = await untilAborted(getToken(attempt > 1), lookupSignal);
      const headers = { Authorization: `Bearer ${token}` };
      const sourceResponse = await untilAborted(fetch(`${endpoint}?source=1`, {
        headers, signal: lookupSignal, cache: "no-store",
      }), lookupSignal);
      if (!sourceResponse.ok) throw await untilAborted(pdfResponseError(sourceResponse, "source"), lookupSignal);
      const source = await untilAborted(sourceResponse.json(), lookupSignal) as { url?: string; requestId?: string } | null;
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new PdfLoadError("The book service returned an unreadable response. Please retry.", "PDF_SOURCE_INVALID", "source", true);
      }
      // Download directly from storage first: large books do not pass through a
      // serverless function. The authenticated proxy covers storage CORS failures.
      let directError: unknown;
      if (source.url) {
        try {
          onProgress({ stage: "download", attempt, transport: "direct", received: 0 });
          return await transfer(source.url, { credentials: "omit", referrerPolicy: "no-referrer" }, downloadSignal, (received, total) => onProgress({ stage: "download", attempt, transport: "direct", received, total }));
        } catch (error) {
          downloadSignal.throwIfAborted();
          directError = error;
        }
      }
      onProgress({ stage: "download", attempt, transport: "proxy", received: 0 });
      try {
        return await transfer(endpoint, { headers }, downloadSignal, (received, total) => onProgress({ stage: "download", attempt, transport: "proxy", received, total }));
      } catch (error) {
        const failure = describePdfError(error);
        failure.requestId ||= source.requestId;
        if (directError) console.warn("PDF direct and proxy downloads failed", { bookId, code: failure.code, requestId: failure.requestId });
        throw failure;
      }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (deadline.aborted) throw describePdfError(deadline.reason);
      lastError = describePdfError(error);
      if (!lastError.retryable || attempt === 2) throw lastError;
      await untilAborted(new Promise<void>((resolve) => setTimeout(resolve, 600)), downloadSignal);
    }
  }
  throw lastError;
}
