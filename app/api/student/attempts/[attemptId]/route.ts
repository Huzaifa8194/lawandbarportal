import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../_lib/auth";
import { studentRouteErrorResponse } from "../../_lib/http-error";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const { attemptId } = await params;
    const id = typeof attemptId === "string" ? attemptId.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Missing attempt id" }, { status: 400 });
    }

    const snap = await adminDb.collection("attempts").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const data = snap.data() as Record<string, unknown>;
    if (data.userId !== uid) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...data,
      id: snap.id,
      createdAt: normalizeDate(data.createdAt) ?? data.createdAt,
    });
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
}
