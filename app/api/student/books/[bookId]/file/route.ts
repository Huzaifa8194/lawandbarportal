import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

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

    const bookSnap = await adminDb.collection("books").doc(bookId).get();
    if (!bookSnap.exists) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const book = bookSnap.data() as { published?: boolean; fileUrl?: string; title?: string } | undefined;
    if (!book?.published) {
      return NextResponse.json({ error: "Book not available" }, { status: 404 });
    }
    if (!book.fileUrl) {
      return NextResponse.json({ error: "Book file URL missing" }, { status: 404 });
    }

    const upstream = await fetch(book.fileUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Failed to load book file" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `inline; filename="${(book.title || "book").replace(/"/g, "")}.pdf"`,
    );
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(upstream.body, {
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
