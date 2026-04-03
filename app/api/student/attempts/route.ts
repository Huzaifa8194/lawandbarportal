import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../_lib/auth";
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

export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const snapshot = await adminDb
      .collection("attempts")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const rows = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        createdAt: normalizeDate(data.createdAt) ?? data.createdAt,
      };
    });
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
