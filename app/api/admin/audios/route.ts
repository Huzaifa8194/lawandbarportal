import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb.collection("audios").orderBy("updatedAt", "desc").get();
    const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
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
      subjectId: string;
      subjectName: string;
      track: "FLK 1" | "FLK 2";
      bookId?: string;
      title: string;
      fileUrl: string;
      filePath: string;
      durationSeconds?: number;
      published: boolean;
    };
    const target = body.id
      ? adminDb.collection("audios").doc(body.id)
      : adminDb.collection("audios").doc();
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
