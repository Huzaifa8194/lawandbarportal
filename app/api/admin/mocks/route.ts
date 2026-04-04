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
          ...(item.data() as Record<string, unknown>),
          id: item.id,
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
      questionIds: unknown;
      durationMinutes: number;
      examMode: boolean;
      revealAnswersInPractice: boolean;
      published: boolean;
    };
    const questionIds = normalizeMockQuestionIds(body.questionIds);
    if (!questionIds.length) {
      return NextResponse.json(
        { error: "At least one MCQ is required. If you selected questions, try saving again; IDs may have been invalid." },
        { status: 400 },
      );
    }
    const target = body.id
      ? adminDb.collection("mock_exams").doc(body.id)
      : adminDb.collection("mock_exams").doc();
    await target.set(
      {
        title: body.title,
        track: body.track,
        subjectIds: Array.isArray(body.subjectIds) ? body.subjectIds : [],
        questionIds,
        durationMinutes: body.durationMinutes,
        examMode: Boolean(body.examMode),
        revealAnswersInPractice: Boolean(body.revealAnswersInPractice),
        published: Boolean(body.published),
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

/** DELETE with JSON body avoids 405s on some hosts where dynamic DELETE routes misbehave. */
export async function DELETE(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Missing mock id" }, { status: 400 });
    }
    await adminDb.collection("mock_exams").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
