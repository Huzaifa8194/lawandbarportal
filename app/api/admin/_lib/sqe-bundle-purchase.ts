import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

/** Matches Main website SQE checkout: `bookId` from `/sqe/bundle/checkout` is `"bundle"`. */
export const SQE_BUNDLE_BOOK_IDS = new Set(["bundle", "sqe-bundle"]);

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Single-field queries only (no composite index required). */
export async function userHasSqeBundlePurchase(db: Firestore, emailRaw: string): Promise<boolean> {
  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();
  if (!email) return false;

  try {
    const snap1 = await db.collection("bookorders").where("userId", "==", email).get();
    for (const doc of snap1.docs) {
      const bookId = doc.data()?.bookId;
      if (typeof bookId === "string" && SQE_BUNDLE_BOOK_IDS.has(bookId)) return true;
    }
  } catch {
    // Collection missing or query error — treat as no Stripe orders
  }

  try {
    const snap2 = await db.collection("bookOrders").where("userEmail", "==", email).get();
    for (const doc of snap2.docs) {
      const bookId = doc.data()?.bookId;
      if (typeof bookId === "string" && SQE_BUNDLE_BOOK_IDS.has(bookId)) return true;
    }
  } catch {
    // Collection missing or query error — treat as no PayPal orders
  }

  return false;
}

/**
 * Batch eligibility for admin list. Uses `in` chunks (max 10) on email only — no composite indexes.
 */
export async function getSqeBundlePurchaserEmailSet(db: Firestore, emails: string[]): Promise<Set<string>> {
  const normalized = [...new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
  const purchased = new Set<string>();

  const ingestDocs = (docs: QueryDocumentSnapshot[], emailField: string) => {
    for (const doc of docs) {
      const data = doc.data() as Record<string, unknown>;
      const bookId = typeof data.bookId === "string" ? data.bookId : "";
      if (!SQE_BUNDLE_BOOK_IDS.has(bookId)) continue;
      const rawEmail = data[emailField];
      const em = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
      if (em) purchased.add(em);
    }
  };

  const runCollection = async (collectionName: string, whereField: string, emailField: string) => {
    const emailChunks = chunkArray(normalized, 10);
    for (const chunk of emailChunks) {
      if (!chunk.length) continue;
      const snap = await db.collection(collectionName).where(whereField, "in", chunk).get();
      ingestDocs(snap.docs, emailField);
    }
  };

  try {
    await runCollection("bookorders", "userId", "userId");
  } catch {
    // ignore — eligibility from Stripe orders unavailable
  }

  try {
    await runCollection("bookOrders", "userEmail", "userEmail");
  } catch {
    // ignore — eligibility from PayPal orders unavailable
  }

  return purchased;
}
