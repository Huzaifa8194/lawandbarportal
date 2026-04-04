import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../../_lib/auth";
import { PORTAL_BOOKS_COLLECTION } from "@/lib/portal-collections";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

function isPdfBuffer(buffer: Buffer) {
  // PDF files start with "%PDF-"
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function safeFilename(input: string) {
  return input.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "book";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    await verifyStudentRequest(request);
    const { bookId } = await params;
    if (!bookId) {
      return NextResponse.json({ error: "Missing book id" }, { status: 400 });
    }

    const bookSnap = await adminDb.collection(PORTAL_BOOKS_COLLECTION).doc(bookId).get();
    if (!bookSnap.exists) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const book = bookSnap.data() as {
      published?: boolean;
      fileUrl?: string;
      filePath?: string;
      title?: string;
    } | undefined;
    if (!book?.published) {
      return NextResponse.json({ error: "Book not available" }, { status: 404 });
    }
    let pdfBuffer: Buffer | null = null;

    // Primary strategy: read directly via Firebase Admin Storage by filePath.
    if (book.filePath) {
      try {
        const file = adminStorage.bucket().file(book.filePath);
        const [exists] = await file.exists();
        if (exists) {
          const [data] = await file.download();
          if (isPdfBuffer(data)) {
            pdfBuffer = data;
          }
        }
      } catch {
        pdfBuffer = null;
      }
    }

    // Fallback strategy: fetch by fileUrl (legacy records).
    if (!pdfBuffer && book.fileUrl) {
      const upstream = await fetch(book.fileUrl);
      if (upstream.ok) {
        const data = Buffer.from(await upstream.arrayBuffer());
        if (isPdfBuffer(data)) {
          pdfBuffer = data;
        }
      }
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "Failed to load a valid PDF file for this book" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `inline; filename="${safeFilename(book.title || "book")}.pdf"`,
    );
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Length", String(pdfBuffer.byteLength));

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
