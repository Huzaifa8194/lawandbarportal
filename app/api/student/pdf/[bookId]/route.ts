import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { randomUUID } from "node:crypto";

function studyLoadFailure(error: unknown, stage: "access" | "read") {
  const requestId = randomUUID();
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : "";
  const status = stage === "access" && (message === "Missing bearer token" || code === "auth/id-token-expired" || code === "auth/argument-error" || code === "auth/id-token-revoked") ? 401
    : stage === "access" && message === "Access denied" ? 403
    : code === 4 || code === "deadline-exceeded" ? 504 : 503;
  console.error("PDF study state load failed", { requestId, stage, code, status, message });
  const errorMessage = status === 401 ? "Sign in again to load your saved study tools."
    : status === 403 ? "Your account cannot access saved study tools."
    : status === 504 ? "Loading your saved study tools timed out."
    : "The service that stores your study tools is temporarily unavailable.";
  return NextResponse.json({ error: errorMessage, requestId }, { status, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  let stage: "access" | "read" = "access";
  try {
    const { uid } = await verifyStudentRequest(request);
    stage = "read";
    const { bookId } = await params;
    const id = `${uid}_${bookId}`;
    const doc = await adminDb.collection("pdf_state").doc(id).get();
    return NextResponse.json(doc.exists ? { id: doc.id, ...doc.data() } : null, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return studyLoadFailure(error, stage);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const body = await request.json();
    if (body.viewerAnnotationsJson != null) {
      if (typeof body.viewerAnnotationsJson !== "string" || Buffer.byteLength(body.viewerAnnotationsJson, "utf8") > 650_000) {
        return NextResponse.json({ error: "PDF annotations exceed the save limit. Export your annotated PDF before adding more annotations." }, { status: 413 });
      }
      try {
        if (body.viewerAnnotationsJson && !Array.isArray(JSON.parse(body.viewerAnnotationsJson))) throw new Error("Invalid annotations");
      } catch {
        return NextResponse.json({ error: "Invalid PDF annotations. Reload your saved notes before editing." }, { status: 400 });
      }
    }
    const { bookId } = await params;
    const id = `${uid}_${bookId}`;
    await adminDb.collection("pdf_state").doc(id).set(
      {
        ...body,
        userId: uid,
        bookId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
