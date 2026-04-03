import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { verifyAdminRequest } from "../../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { SQE_BUNDLE_BOOK_IDS } from "../../../_lib/sqe-bundle-purchase";

function serializeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      serializeFirestoreValue(v),
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

function serializeDoc(data: Record<string, unknown>): Record<string, unknown> {
  return serializeFirestoreValue(data) as Record<string, unknown>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await verifyAdminRequest(request);
    const { uid } = await params;

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : null;
    const userSerialized = userData ? serializeDoc(userData) : null;

    const emailRaw = userData && typeof userData.email === "string" ? userData.email : "";
    const emailNormalized = String(emailRaw || "")
      .trim()
      .toLowerCase();

    const orderErrors: { collection: string; message: string }[] = [];

    type OrderRow = {
      id: string;
      data: Record<string, unknown>;
      bookId: string | null;
      matchesSqeBundle: boolean;
      matchReasons: string[];
    };

    const fetchOrders = async (
      collectionName: "bookorders" | "bookOrders",
      field: "userId" | "userEmail",
    ): Promise<OrderRow[]> => {
      if (!emailNormalized) return [];
      try {
        const snap = await adminDb.collection(collectionName).where(field, "==", emailNormalized).get();
        return snap.docs.map((doc) => {
          const data = serializeDoc(doc.data() as Record<string, unknown>);
          const bookIdRaw = (doc.data() as { bookId?: unknown }).bookId;
          const bookId = typeof bookIdRaw === "string" ? bookIdRaw : null;
          const matchesSqeBundle = !!bookId && SQE_BUNDLE_BOOK_IDS.has(bookId);
          const matchReasons: string[] = [];
          if (!bookId) {
            matchReasons.push("No `bookId` on this order (or not a string).");
          } else if (matchesSqeBundle) {
            matchReasons.push(
              `\`bookId\` is "${bookId}" — matches SQE bundle list (${[...SQE_BUNDLE_BOOK_IDS].join(", ")}).`,
            );
          } else {
            matchReasons.push(
              `\`bookId\` is "${bookId}" — not an SQE bundle id (need one of: ${[...SQE_BUNDLE_BOOK_IDS].join(", ")}).`,
            );
          }
          return { id: doc.id, data, bookId, matchesSqeBundle, matchReasons };
        });
      } catch (e) {
        orderErrors.push({
          collection: collectionName,
          message: e instanceof Error ? e.message : String(e),
        });
        return [];
      }
    };

    const [stripeOrders, paypalOrders] = await Promise.all([
      fetchOrders("bookorders", "userId"),
      fetchOrders("bookOrders", "userEmail"),
    ]);

    const qualifying: { collection: string; id: string; bookId: string }[] = [];
    for (const o of stripeOrders) {
      if (o.matchesSqeBundle && o.bookId) qualifying.push({ collection: "bookorders", id: o.id, bookId: o.bookId });
    }
    for (const o of paypalOrders) {
      if (o.matchesSqeBundle && o.bookId) qualifying.push({ collection: "bookOrders", id: o.id, bookId: o.bookId });
    }

    const sqeBundlePurchased = qualifying.length > 0;

    const rawAccess = userData?.accessEnabled;
    const accessExplicitlyFalse = rawAccess === false;
    const accessNotExplicitlyDisabled = rawAccess !== false;

    const effectiveAccessEnabled = sqeBundlePurchased && accessNotExplicitlyDisabled;

    const explanation: string[] = [];
    explanation.push(`Firestore path: \`users/${uid}\`.`);

    if (!userSnap.exists) {
      explanation.push("No user document — cannot evaluate access.");
    } else {
      explanation.push(
        `Raw \`accessEnabled\` on user doc: ${rawAccess === undefined ? "undefined (treated as not disabled)" : JSON.stringify(rawAccess)}.`,
      );
      if (accessExplicitlyFalse) {
        explanation.push(
          "Admin has set `accessEnabled: false` — portal access is forced off even if the SQE bundle was purchased.",
        );
      } else {
        explanation.push("`accessEnabled` is not `false` — admin gate allows access if bundle is purchased.");
      }
    }

    if (!emailNormalized) {
      explanation.push("No normalized email on user doc — cannot match `bookorders` / `bookOrders` (eligibility stays false).");
    } else {
      explanation.push(
        `Orders queried: \`bookorders\` where \`userId\` == "${emailNormalized}" (${stripeOrders.length} doc(s)); \`bookOrders\` where \`userEmail\` == "${emailNormalized}" (${paypalOrders.length} doc(s)).`,
      );
      if (sqeBundlePurchased) {
        explanation.push(
          `SQE bundle: YES — at least one order has a qualifying \`bookId\` (${qualifying.map((q) => `${q.collection}/${q.id}`).join(", ")}).`,
        );
      } else {
        explanation.push(
          "SQE bundle: NO — no order doc has `bookId` in the bundle set (`bundle`, `sqe-bundle`), or collections failed to load.",
        );
      }
    }

    explanation.push(
      `Effective portal access (same as admin list): \`sqeBundlePurchased && accessEnabled !== false\` → **${effectiveAccessEnabled ? "ENABLED" : "DISABLED"}**.`,
    );

    return NextResponse.json({
      uid,
      user: userSnap.exists
        ? { path: userRef.path, id: userSnap.id, data: userSerialized as Record<string, unknown> }
        : null,
      emailNormalized: emailNormalized || null,
      constants: { sqeBundleBookIds: [...SQE_BUNDLE_BOOK_IDS] },
      orders: {
        bookorders: stripeOrders,
        bookOrders: paypalOrders,
      },
      orderQueryErrors: orderErrors,
      summary: {
        sqeBundlePurchased,
        rawAccessEnabled: rawAccess === undefined ? null : rawAccess,
        accessExplicitlyFalse,
        effectiveAccessEnabled,
      },
      explanation,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
