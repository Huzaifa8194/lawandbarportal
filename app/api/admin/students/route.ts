import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

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

    // Logic used across the portal: a user is considered an SQE-bundle buyer
    // if their orders include the SQE bundle item ID ("bundle").
    const SQE_BUNDLE_BOOK_IDS = new Set(["bundle", "sqe-bundle"]);

    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const emails = users
      .map((u) => (u.email ? String(u.email).toLowerCase() : ""))
      .filter(Boolean);

    const purchasedEmailSet = new Set<string>();

    // Stripe orders in main website: collection "bookorders" with fields { userId, bookId }
    // PayPal orders in main website: collection "bookOrders" with fields { userEmail, bookId }
    const fetchPurchasesForEmails = async (params: {
      collectionName: string;
      whereField: string;
      emailField: string;
      chunkSize: number;
    }) => {
      const emailChunks = chunkArray(emails, params.chunkSize);
      for (const chunk of emailChunks) {
        if (!chunk.length) continue;

        const snap = await adminDb
          .collection(params.collectionName)
          .where(params.whereField, "in", chunk)
          .get();

        for (const doc of snap.docs) {
          const data = doc.data() as Record<string, unknown>;
          const bookId = typeof data.bookId === "string" ? data.bookId : "";
          if (!SQE_BUNDLE_BOOK_IDS.has(bookId)) continue;

          const rawEmail = data[params.emailField];
          const email = typeof rawEmail === "string" ? rawEmail.toLowerCase() : "";
          if (email) purchasedEmailSet.add(email);
        }
      }
    };

    // Query both order collections (best-effort; if a collection doesn't exist, it just returns empty).
    await fetchPurchasesForEmails({
      collectionName: "bookorders",
      whereField: "userId",
      emailField: "userId",
      chunkSize: 10,
    });

    await fetchPurchasesForEmails({
      collectionName: "bookOrders",
      whereField: "userEmail",
      emailField: "userEmail",
      chunkSize: 10,
    });

    // Enforce rule: only SQE-bundle buyers should have access enabled.
    for (const user of users) {
      const email = user.email ? String(user.email).toLowerCase() : "";
      const sqeBundlePurchased = !!email && purchasedEmailSet.has(email);

      // If access is currently enabled but user isn't eligible, disable them now.
      if (!sqeBundlePurchased && user.accessEnabled !== false) {
        await adminDb.collection("users").doc(user.uid).set(
          { accessEnabled: false },
          { merge: true },
        );
      }
    }

    const rows = users.map((user) => {
      const email = user.email ? String(user.email).toLowerCase() : "";
      const sqeBundlePurchased = !!email && purchasedEmailSet.has(email);
      return {
        ...user,
        sqeBundlePurchased,
        // Make the returned access state consistent with eligibility.
        accessEnabled: sqeBundlePurchased ? user.accessEnabled : false,
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
