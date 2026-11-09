import { PdfLoadError, describePdfError, pdfResponseError } from "@/lib/pdf-errors";

type Progress = { stage: "source" | "download"; attempt: number; received?: number; total?: number; transport?: "direct" | "proxy" };

async function readPdf(response: Response, progress: (received: number, total?: number) => void) {
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
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new Uint8Array(value));
      received += value.byteLength;
      progress(received, total);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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
  let lastError: PdfLoadError | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal.aborted) throw signal.reason;
    try {
      onProgress({ stage: "source", attempt });
      const token = await getToken(attempt > 1);
      const headers = { Authorization: `Bearer ${token}` };
      const sourceResponse = await fetch(`${endpoint}?source=1`, {
        headers, signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]), cache: "no-store",
      });
      if (!sourceResponse.ok) throw await pdfResponseError(sourceResponse, "source");
      const source = await sourceResponse.json() as { url?: string; requestId?: string };
      // Download directly from storage first: large books do not pass through a
      // serverless function. The authenticated proxy covers storage CORS failures.
      let directError: unknown;
      if (source.url) {
        try {
          onProgress({ stage: "download", attempt, transport: "direct", received: 0 });
          const response = await fetch(source.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]), cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
          return await readPdf(response, (received, total) => onProgress({ stage: "download", attempt, transport: "direct", received, total }));
        } catch (error) {
          if (signal.aborted) throw signal.reason;
          directError = error;
        }
      }
      onProgress({ stage: "download", attempt, transport: "proxy", received: 0 });
      try {
        const response = await fetch(endpoint, { headers, signal: AbortSignal.any([signal, AbortSignal.timeout(115_000)]), cache: "no-store" });
        return await readPdf(response, (received, total) => onProgress({ stage: "download", attempt, transport: "proxy", received, total }));
      } catch (error) {
        const failure = describePdfError(error);
        failure.requestId ||= source.requestId;
        if (directError) console.warn("PDF direct and proxy downloads failed", { bookId, code: failure.code, requestId: failure.requestId });
        throw failure;
      }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      lastError = describePdfError(error);
      if (!lastError.retryable || attempt === 3) throw lastError;
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 600 * 2 ** (attempt - 1));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    }
  }
  throw lastError;
}
