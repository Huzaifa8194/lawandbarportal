import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../_lib/auth";
import { studentRouteErrorResponse } from "../_lib/http-error";
import { adminDb } from "@/lib/firebase-admin";

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function createdAtSortKey(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    /**
     * Do not use orderBy("createdAt") with where("userId"): that needs a composite index.
     * Without it Firestore throws; the old handler returned 403 for every error, so the
     * dashboard looked "blocked" while POST createAttempt still worked.
     * Fetch all rows for this user (typical volume is small), sort newest-first in memory.
     */
    const snapshot = await adminDb.collection("attempts").where("userId", "==", uid).get();
    const rows = snapshot.docs
      .map((item) => {
        const data = item.data();
        return {
          ...data,
          id: item.id,
          createdAt: normalizeDate(data.createdAt) ?? data.createdAt,
        };
      })
      .sort((a, b) => createdAtSortKey(b.createdAt) - createdAtSortKey(a.createdAt))
      .slice(0, 50);
    return NextResponse.json(rows);
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const body = await request.json();
    const docRef = await adminDb.collection("attempts").add({
      ...body,
      userId: uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
}
