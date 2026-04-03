import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);

    await adminDb.collection("users").doc(decoded.uid).set(
      {
        uid: decoded.uid,
        email: decoded.email ?? null,
        isAdmin: true,
        accessEnabled: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, uid: decoded.uid });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
