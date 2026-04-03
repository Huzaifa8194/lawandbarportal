import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { Mcq, MockExam } from "@/lib/types/admin";

function normalizeQuestionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mockId: string }> },
) {
  try {
    await verifyStudentRequest(request);
    const { mockId } = await params;
    if (!mockId) {
      return NextResponse.json({ error: "Missing mock id" }, { status: 400 });
    }

    const mockSnap = await adminDb.collection("mock_exams").doc(mockId).get();
    if (!mockSnap.exists) {
      return NextResponse.json({ error: "Mock not found" }, { status: 404 });
    }

    const data = mockSnap.data() as Omit<MockExam, "id">;
    if (!data.published) {
      return NextResponse.json({ error: "Mock not available" }, { status: 404 });
    }

    const questionIds = normalizeQuestionIds(data.questionIds);
    if (!questionIds.length) {
      return NextResponse.json({ error: "Mock has no questions" }, { status: 404 });
    }

    const refs = questionIds.map((id) => adminDb.collection("mcqs").doc(id));
    const snapshots = [];
    const chunkSize = 100;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const slice = refs.slice(i, i + chunkSize);
      const batch = await adminDb.getAll(...slice);
      snapshots.push(...batch);
    }

    const byId = new Map<string, Mcq>();
    for (const snap of snapshots) {
      if (!snap.exists) continue;
      const row = { id: snap.id, ...(snap.data() as Omit<Mcq, "id">) };
      byId.set(snap.id, row as Mcq);
    }

    const questions: Mcq[] = [];
    for (const id of questionIds) {
      const q = byId.get(id);
      if (q) questions.push(q);
    }

    if (!questions.length) {
      return NextResponse.json({ error: "No questions could be loaded for this mock" }, { status: 404 });
    }

    const mock: MockExam = {
      id: mockSnap.id,
      ...data,
      questionIds,
    };

    return NextResponse.json({ mock, questions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
