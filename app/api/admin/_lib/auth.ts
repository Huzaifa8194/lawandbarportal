import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function verifyAdminRequest(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authHeader.replace("Bearer ", "");
  const decoded = await adminAuth.verifyIdToken(token);
  const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userDoc.data();

  if (!userDoc.exists || !userData?.isAdmin) {
    throw new Error("Forbidden: admin only");
  }

  return { uid: decoded.uid };
}
