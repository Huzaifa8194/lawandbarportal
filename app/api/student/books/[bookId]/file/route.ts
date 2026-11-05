import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../../_lib/auth";
import { studentRouteErrorResponse } from "../../../_lib/http-error";
import { PORTAL_BOOKS_COLLECTION } from "@/lib/portal-collections";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  try {
    await verifyStudentRequest(request);
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
  try {
    const { bookId } = await params;
    if (!bookId) return NextResponse.json({ error: "Missing book id" }, { status: 400 });
    const snap = await adminDb.collection(PORTAL_BOOKS_COLLECTION).doc(bookId).get();
    const book = snap.data();
    if (!snap.exists || !book?.published) {
      return NextResponse.json({ error: "Book not available" }, { status: 404 });
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]);
    let stream: ReadableStream<Uint8Array> | undefined;
    const bucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (book.filePath && bucket) {
      try {
        stream = await pdfStream(adminStorage.bucket(bucket).file(book.filePath).createReadStream(), signal);
      } catch (error) {
        console.error("Book storage stream failed", bookId, error);
      }
    }
    if (!stream && book.fileUrl && !signal.aborted) {
      const upstream = await fetch(book.fileUrl, { signal, cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        throw new Error(`PDF upstream returned ${upstream.status}`);
      }
      stream = await pdfStream(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), signal);
    }
    if (!stream) throw new Error("No valid PDF source available");
    const filename = String(book.title || "book").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "book";
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="book.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}.pdf`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Book PDF load failed", error);
    return NextResponse.json({ error: "PDF is temporarily unavailable. Please retry." }, { status: 502 });
  }
}
