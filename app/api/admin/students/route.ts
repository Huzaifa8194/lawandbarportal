import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb.collection("users").get();
    const rows = snapshot.docs
      .map(
        (item) =>
          ({
            uid: item.id,
            ...(item.data() as { isAdmin?: boolean; [key: string]: unknown }),
          }) as { uid: string; isAdmin?: boolean; [key: string]: unknown },
      )
      .filter((item) => !item.isAdmin);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
