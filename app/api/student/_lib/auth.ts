import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function verifyStudentRequest(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = bearerToken || queryToken;
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userDoc.data();

  if (!userDoc.exists || userData?.accessEnabled === false) {
    throw new Error("Access disabled");
  }

  return { uid: decoded.uid };
}
