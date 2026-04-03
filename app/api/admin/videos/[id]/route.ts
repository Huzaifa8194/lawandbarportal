import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyAdminRequest(request);
    const { id } = await params;
    await adminDb.collection("videos").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
