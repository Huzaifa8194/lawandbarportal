import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { userHasSqeBundlePurchase } from "../../../_lib/sqe-bundle-purchase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await verifyAdminRequest(request);
    const body = (await request.json()) as { accessEnabled: boolean };
    const { uid } = await params;

    if (body.accessEnabled) {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      const email = userSnap.exists ? String(userSnap.data()?.email ?? "") : "";
      const purchased = await userHasSqeBundlePurchase(adminDb, email);
      if (!purchased) {
        return NextResponse.json(
          { error: "This student has not purchased the SQE bundle." },
          { status: 400 },
        );
      }
    }

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
