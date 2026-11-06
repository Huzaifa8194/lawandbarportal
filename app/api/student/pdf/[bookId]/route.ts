import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const { bookId } = await params;
    const id = `${uid}_${bookId}`;
    const doc = await adminDb.collection("pdf_state").doc(id).get();
    return NextResponse.json(doc.exists ? { id: doc.id, ...doc.data() } : null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const body = await request.json();
    if (body.viewerAnnotationsJson != null) {
      if (typeof body.viewerAnnotationsJson !== "string" || Buffer.byteLength(body.viewerAnnotationsJson, "utf8") > 650_000) {
        return NextResponse.json({ error: "PDF annotations exceed the save limit. Export your annotated PDF before adding more annotations." }, { status: 413 });
      }
      try {
        if (body.viewerAnnotationsJson && !Array.isArray(JSON.parse(body.viewerAnnotationsJson))) throw new Error("Invalid annotations");
      } catch {
        return NextResponse.json({ error: "Invalid PDF annotations. Reload your saved notes before editing." }, { status: 400 });
      }
    }
    const { bookId } = await params;
    const id = `${uid}_${bookId}`;
    await adminDb.collection("pdf_state").doc(id).set(
      {
        ...body,
        userId: uid,
        bookId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
