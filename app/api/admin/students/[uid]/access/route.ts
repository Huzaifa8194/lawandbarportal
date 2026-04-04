import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await verifyAdminRequest(request);
    const body = (await request.json()) as { accessEnabled: boolean };
    const { uid } = await params;

    await adminDb.collection("users").doc(uid).set(
      {
        accessEnabled: body.accessEnabled,
        updatedBy: admin.uid,
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
