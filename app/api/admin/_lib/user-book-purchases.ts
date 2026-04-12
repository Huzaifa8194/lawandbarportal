import type { Firestore } from "firebase-admin/firestore";

/**
 * All `bookId` values the user has purchased (Stripe `bookorders` + PayPal `bookOrders`).
 * Matches Main website mock exam access checks.
 */
export async function getUserPurchasedBookIds(db: Firestore, emailRaw: string): Promise<Set<string>> {
  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();
  const ids = new Set<string>();
  if (!email) return ids;

  try {
    const snap1 = await db.collection("bookorders").where("userId", "==", email).get();
    for (const doc of snap1.docs) {
      const bookId = doc.data()?.bookId;
      if (typeof bookId === "string" && bookId) ids.add(bookId);
    }
  } catch {
    // ignore
  }

  try {
    const snap2 = await db.collection("bookOrders").where("userEmail", "==", email).get();
    for (const doc of snap2.docs) {
      const bookId = doc.data()?.bookId;
      if (typeof bookId === "string" && bookId) ids.add(bookId);
    }
  } catch {
    // ignore
  }

  return ids;
}
