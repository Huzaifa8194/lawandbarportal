import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { PORTAL_UPDATES_COLLECTION } from "@/lib/portal-collections";
import { deleteStoragePaths, uniquePaths } from "../_lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await verifyAdminRequest(request);
    const { id } = await params;
    const ref = adminDb.collection(PORTAL_UPDATES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    const data = snap.data();
    await deleteStoragePaths(
      uniquePaths(
        data?.imagePaths as string[] | undefined,
        data?.coverImagePath as string | undefined,
      ),
    );
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
