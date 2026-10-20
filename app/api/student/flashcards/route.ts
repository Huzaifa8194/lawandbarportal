import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../_lib/auth";
import { studentRouteErrorResponse } from "../_lib/http-error";
import { adminDb } from "@/lib/firebase-admin";
import { FLASHCARD_COLLECTION } from "@/lib/flashcards";
export async function GET(request: NextRequest) {
  try {
    await verifyStudentRequest(request);
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid deck ID" }, { status: 400 });
      const doc = await adminDb.collection(FLASHCARD_COLLECTION).doc(id).get();
      if (!doc.exists || doc.data()?.published !== true) return NextResponse.json({ error: "Deck unavailable" }, { status: 404 });
      return NextResponse.json({ ...doc.data(), id: doc.id, updatedBy: undefined });
    }
    const docs = await adminDb.collection(FLASHCARD_COLLECTION).where("published", "==", true).select("title", "topic", "subjectId", "subjectName", "track", "published", "cardCount", "updatedAt").get();
    return NextResponse.json(docs.docs.map(doc => { const data = doc.data(); delete data.cards; delete data.updatedBy; return { ...data, id: doc.id }; }));
  } catch (error) { return studentRouteErrorResponse(error); }
}
