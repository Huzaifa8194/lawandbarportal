import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../_lib/auth";
import { adminDb, adminStorage } from "@/lib/firebase-admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyAdminRequest(request);
    const { id } = await params;
    const snap = await adminDb.collection("books").doc(id).get();
    const filePath = snap.data()?.filePath as string | undefined;
    if (filePath) {
      try {
        await adminStorage.bucket().file(filePath).delete();
      } catch {
        // Missing file or permission — still remove Firestore doc
      }
    }
    await adminDb.collection("books").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
