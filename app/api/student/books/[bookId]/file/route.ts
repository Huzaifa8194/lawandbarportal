import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../../_lib/auth";
import { PORTAL_BOOKS_COLLECTION } from "@/lib/portal-collections";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { PdfLoadError } from "@/lib/pdf-errors";

export const runtime = "nodejs";
export const maxDuration = 120;

function storageLocation(fileUrl: unknown, filePath: unknown) {
  const configured = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (typeof fileUrl === "string") {
    try {
      const url = new URL(fileUrl);
      const match = url.hostname === "firebasestorage.googleapis.com" && url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (match) return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
    } catch { /* Legacy records may only have a storage path. */ }
  }
  return typeof filePath === "string" && configured ? { bucket: configured, path: filePath } : null;
}

async function bounded<T>(operation: Promise<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PdfLoadError("The PDF service timed out. Please retry.", "PDF_SERVICE_TIMEOUT", "source", true)), milliseconds);
    })]);
  } finally {
    clearTimeout(timer!);
  }
}

// Inspect only the prefix, then stream the rest without buffering a whole book.
async function pdfStream(source: Readable, signal: AbortSignal) {
  const abort = () => source.destroy(new Error("PDF request aborted"));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const iterator = source[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (size < 5) {
      const chunk = await iterator.next();
      if (chunk.done) break;
      const buffer = Buffer.from(chunk.value);
      chunks.push(buffer);
      size += buffer.length;
    }
    if (Buffer.concat(chunks).subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("Invalid PDF file");
    }
  } catch (error) {
    signal.removeEventListener("abort", abort);
    source.destroy();
    throw error;
  }
  const cleanup = () => {
    signal.removeEventListener("abort", abort);
    source.destroy();
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const buffered = chunks.shift();
        if (buffered) {
          controller.enqueue(buffered);
          return;
        }
        const chunk = await iterator.next();
        if (chunk.done) {
          cleanup();
          controller.close();
        } else {
          controller.enqueue(new Uint8Array(chunk.value));
        }
      } catch (error) {
        cleanup();
        controller.error(error);
      }
    },
    cancel: cleanup,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const requestId = randomUUID();
  let stage: "access" | "source" = "access";
  try {
    await bounded(verifyStudentRequest(request));
    stage = "source";
    const { bookId } = await params;
    if (!bookId) return NextResponse.json({ error: "Missing book id" }, { status: 400 });
    const snap = await bounded(adminDb.collection(PORTAL_BOOKS_COLLECTION).doc(bookId).get());
    const book = snap.data();
    if (!snap.exists || !book?.published) {
      throw new PdfLoadError("This book is no longer available. Please contact support.", "PDF_BOOK_UNAVAILABLE", "source", false, requestId, 404);
    }
    const location = storageLocation(book.fileUrl, book.filePath);
    if (request.nextUrl.searchParams.get("source") === "1") {
      let url: string | undefined;
      if (location) {
        try {
          const file = adminStorage.bucket(location.bucket).file(location.path);
          const [metadata] = await bounded(file.getMetadata());
          const token = metadata.metadata?.firebaseStorageDownloadTokens?.toString().split(",")[0];
          if (token) {
            url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(location.bucket)}/o/${encodeURIComponent(location.path)}?alt=media&token=${encodeURIComponent(token)}`;
          } else {
            [url] = await bounded(file.getSignedUrl({ action: "read", expires: Date.now() + 15 * 60_000 }));
          }
        } catch (error) {
          const code = (error as {code?: unknown})?.code;
          console.error("PDF source resolution failed", { requestId, code, bucket: location.bucket, path: location.path });
          if (code === 404) throw new PdfLoadError("The PDF file is missing from storage. Please ask support to re-upload this book.", "PDF_FILE_MISSING", "source", false, requestId, 404);
          // Existing download tokens can still work when Admin metadata/signing
          // permission is unavailable. The proxy remains the second transport.
          if (typeof book.fileUrl === "string") url = book.fileUrl;
        }
      } else if (typeof book.fileUrl === "string") {
        url = book.fileUrl;
      }
      if (!url && !location) throw new PdfLoadError("No PDF file is attached to this book. Please contact support.", "PDF_SOURCE_MISSING", "source", false, requestId, 404);
      return NextResponse.json({ url, requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]);
    let stream: ReadableStream<Uint8Array> | undefined;
    if (location) {
      try {
        stream = await pdfStream(adminStorage.bucket(location.bucket).file(location.path).createReadStream(), signal);
      } catch (error) {
        console.error("PDF storage stream failed", { requestId, bookId, message: error instanceof Error ? error.message : "Storage error" });
      }
    }
    if (!stream && book.fileUrl && !signal.aborted) {
      const upstream = await fetch(book.fileUrl, { signal, cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        throw new PdfLoadError(upstream.status === 404 ? "The PDF file is missing. Please contact support." : upstream.status === 403 ? "Storage denied access to this PDF. Please ask support to check the file permissions." : `PDF storage returned HTTP ${upstream.status}. Please retry.`, `PDF_STORAGE_${upstream.status}`, "download", upstream.status >= 500 || upstream.status === 408 || upstream.status === 429, requestId, upstream.status === 404 ? 404 : 502);
      }
      stream = await pdfStream(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), signal);
    }
    if (!stream) throw new PdfLoadError("No readable PDF file is available for this book. Please contact support.", "PDF_SOURCE_MISSING", "source", false, requestId, 404);
    const filename = String(book.title || "book").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "book";
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="book.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    const authCode = (error as {code?: string})?.code;
    let failure: PdfLoadError;
    if (error instanceof PdfLoadError) failure = error;
    else if (stage === "access" && (authCode?.startsWith("auth/") || (error instanceof Error && error.message === "Missing bearer token"))) {
      failure = new PdfLoadError("Your session has expired. Sign in again to open this book.", "PDF_SESSION_EXPIRED", "access", true, requestId, 401);
    } else if (error instanceof Error && error.message === "Access denied") {
      failure = new PdfLoadError("Your account does not have portal access. Please contact support.", "PDF_ACCESS_DENIED", "access", false, requestId, 403);
    } else if (error instanceof Error && error.message === "Invalid PDF file") {
      failure = new PdfLoadError("The stored file is not a valid PDF. Please ask support to replace it.", "PDF_INVALID_FILE", "download", false, requestId, 422);
    } else {
      failure = new PdfLoadError(stage === "access" ? "The access check failed. Please retry or contact support." : "The PDF storage service could not complete the request. Please retry.", stage === "access" ? "PDF_ACCESS_SERVICE" : "PDF_STORAGE_FAILURE", stage, true, requestId, 503);
    }
    console.error("PDF request failed", { requestId, stage: failure.stage, code: failure.code, cause: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: failure.message, code: failure.code, stage: failure.stage, retryable: failure.retryable, requestId }, { status: failure.status || 504, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  }
}
