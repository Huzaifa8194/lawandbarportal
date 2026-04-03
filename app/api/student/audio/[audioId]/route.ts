import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const { audioId } = await params;
    const id = `${uid}_${audioId}`;
    const doc = await adminDb.collection("audio_state").doc(id).get();
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
  { params }: { params: Promise<{ audioId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const body = await request.json();
    const { audioId } = await params;
    const id = `${uid}_${audioId}`;
    await adminDb.collection("audio_state").doc(id).set(
      {
        ...body,
        userId: uid,
        audioId,
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
