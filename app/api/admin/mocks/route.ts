import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { normalizeMockQuestionIds } from "@/lib/normalize-mock-question-ids";

type MockExamListRow = {
  id: string;
  updatedAt?: string;
} & Record<string, unknown>;

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb.collection("mock_exams").get();
    const rows = snapshot.docs
      .map(
        (item): MockExamListRow => ({
          id: item.id,
          ...(item.data() as Record<string, unknown>),
        }),
      )
      .sort((a, b) => {
        const aTime = typeof a.updatedAt === "string" ? Date.parse(a.updatedAt) : 0;
        const bTime = typeof b.updatedAt === "string" ? Date.parse(b.updatedAt) : 0;
        return bTime - aTime;
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
        questionIds: normalizeMockQuestionIds(body.questionIds),
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
