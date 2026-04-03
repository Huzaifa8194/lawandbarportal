import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const snapshot = await adminDb
      .collection("attempts")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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
