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
