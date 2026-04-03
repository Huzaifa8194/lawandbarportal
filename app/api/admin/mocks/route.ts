import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb.collection("mock_exams").orderBy("updatedAt", "desc").get();
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
    const admin = await verifyAdminRequest(request);
    const body = (await request.json()) as {
      id?: string;
      title: string;
      track: "FLK 1" | "FLK 2";
      subjectIds: string[];
      questionIds: string[];
      durationMinutes: number;
      examMode: boolean;
      revealAnswersInPractice: boolean;
      published: boolean;
    };
    const target = body.id
      ? adminDb.collection("mock_exams").doc(body.id)
      : adminDb.collection("mock_exams").doc();
    await target.set(
      {
        ...body,
        updatedBy: admin.uid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ id: target.id, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
