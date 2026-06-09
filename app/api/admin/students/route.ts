import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { getSqeBundlePurchaserEmailSet } from "../_lib/sqe-bundle-purchase";
import { buildStudentProgressMap } from "../_lib/student-progress";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);

    const snapshot = await adminDb.collection("users").get();
    const users = snapshot.docs
      .map(
        (item) =>
          ({
            uid: item.id,
            ...(item.data() as {
              isAdmin?: boolean;
              email?: string;
              accessEnabled?: boolean;
              portalAccessViaCode?: boolean;
              [key: string]: unknown;
            }),
          }) as {
            uid: string;
            isAdmin?: boolean;
            email?: string;
            accessEnabled?: boolean;
            portalAccessViaCode?: boolean;
            [key: string]: unknown;
          },
      )
      .filter((item) => !item.isAdmin);

    const emails = users.map((u) => (u.email ? String(u.email).toLowerCase() : "")).filter(Boolean);

    const purchasedEmailSet = await getSqeBundlePurchaserEmailSet(adminDb, emails);
    const progressMap = await buildStudentProgressMap(
      adminDb,
      users.map((user) => user.uid),
    );

    const rows = users.map((user) => {
      const email = user.email ? String(user.email).toLowerCase() : "";
      const sqeBundlePurchased = !!email && purchasedEmailSet.has(email);
      const portalAccessViaCode = user.portalAccessViaCode === true;
      const eligible = sqeBundlePurchased || portalAccessViaCode;
      const raw = user.accessEnabled;
      const accessEnabledRaw = raw === undefined ? null : raw === true;
      const adminGodmode = raw === true;
      return {
        ...user,
        sqeBundlePurchased,
        portalAccessViaCode,
        accessEnabledRaw,
        /** Matches portal login: true if admin set accessEnabled, or eligible with access not explicitly false. */
        accessEnabled: adminGodmode || (eligible && raw !== false),
        progress: progressMap.get(user.uid),
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
