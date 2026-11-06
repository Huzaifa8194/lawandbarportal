export type PdfFailureStage = "access" | "source" | "download" | "render" | "save";

export class PdfLoadError extends Error {
  constructor(
    message: string,
    public code: string,
    public stage: PdfFailureStage,
    public retryable = false,
    public requestId?: string,
    public status?: number,
  ) {
    super(message);
    this.name = "PdfLoadError";
  }
}

export function describePdfError(error: unknown): PdfLoadError {
  if (error instanceof PdfLoadError) return error;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new PdfLoadError("The PDF download timed out. Check your connection and retry.", "PDF_TIMEOUT", "download", true);
  }
  return new PdfLoadError("The PDF download was interrupted. Check your internet connection and retry.", "PDF_NETWORK", "download", true);
}

export async function pdfResponseError(response: Response, stage: PdfFailureStage) {
  const payload = await response.json().catch(() => null);
  const messages: Record<number, string> = {
    401: "Your session has expired. Sign in again to open this book.",
    403: "Your account does not have access to this book. Contact support if this is unexpected.",
    404: "This book or its PDF file is no longer available. Please contact support.",
    408: "The server timed out while preparing the PDF. Please retry.",
    429: "Too many PDF requests. Wait a moment, then retry.",
  };
  return new PdfLoadError(
    payload?.error || messages[response.status] || `The PDF server returned HTTP ${response.status}. Please retry or contact support.`,
    payload?.code || `PDF_HTTP_${response.status}`,
    payload?.stage || stage,
    payload?.retryable ?? ([401, 408, 429].includes(response.status) || response.status >= 500),
    payload?.requestId || response.headers.get("X-Request-Id") || undefined,
    response.status,
  );
}
