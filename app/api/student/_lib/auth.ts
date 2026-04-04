import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { getPortalAccessState } from "@/app/api/_lib/portal-access";

export async function verifyStudentRequest(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = bearerToken || queryToken;
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const state = await getPortalAccessState(decoded.uid);

  if (!state.allowed) {
    throw new Error("Access denied");
  }

  return { uid: decoded.uid };
}
