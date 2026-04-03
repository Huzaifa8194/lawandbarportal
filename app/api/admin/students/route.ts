import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { getSqeBundlePurchaserEmailSet } from "../_lib/sqe-bundle-purchase";
//random comment
export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);

    const snapshot = await adminDb.collection("users").get();
    const users = snapshot.docs
      .map(
        (item) =>
          ({
            uid: item.id,
            ...(item.data() as { isAdmin?: boolean; email?: string; accessEnabled?: boolean; [key: string]: unknown }),
          }) as { uid: string; isAdmin?: boolean; email?: string; accessEnabled?: boolean; [key: string]: unknown },
      )
      .filter((item) => !item.isAdmin);

    const emails = users.map((u) => (u.email ? String(u.email).toLowerCase() : "")).filter(Boolean);

    const purchasedEmailSet = await getSqeBundlePurchaserEmailSet(adminDb, emails);

    const rows = users.map((user) => {
      const email = user.email ? String(user.email).toLowerCase() : "";
      const sqeBundlePurchased = !!email && purchasedEmailSet.has(email);
      return {
        ...user,
        sqeBundlePurchased,
        // UI + API contract: access is only "on" when eligible and not explicitly disabled.
        accessEnabled: sqeBundlePurchased && user.accessEnabled !== false,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
