import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { getPortalAccessState } from "@/app/api/_lib/portal-access";

/**
 * Returns whether the signed-in user may use the student portal (and sets policy for cookies).
 * Auth: Firebase ID token (Authorization: Bearer).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const state = await getPortalAccessState(decoded.uid);

    return NextResponse.json({
      allowed: state.allowed,
      isAdmin: state.isAdmin,
      reason: state.reason,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized", allowed: false },
      { status: 401 },
    );
  }
}
