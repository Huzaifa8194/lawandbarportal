import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FLASHCARD_COLLECTION, MAX_CARDS, normalizeFlashcard } from "@/lib/flashcards";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid deck ID" }, { status: 400 });
      const doc = await adminDb.collection(FLASHCARD_COLLECTION).doc(id).get();
      if (!doc.exists) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
      return NextResponse.json({ ...doc.data(), id: doc.id });
    }
    const docs = await adminDb.collection(FLASHCARD_COLLECTION).select("title", "topic", "subjectId", "subjectName", "track", "published", "cardCount", "updatedAt").get();
    return NextResponse.json(docs.docs.map(doc => { const data = doc.data(); delete data.cards; return { ...data, id: doc.id }; }));
  } catch { return NextResponse.json({ error: "Unable to load flashcards. Check your admin access." }, { status: 403 }); }
}
export async function POST(request: NextRequest) {
  let admin;
  try { admin = await verifyAdminRequest(request); } catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 750000) return NextResponse.json({ error: "Deck is too large. Split it into smaller decks." }, { status: 400 });
    const body = JSON.parse(raw);
    const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const title = text(body.title, 160), topic = text(body.topic, 160), subjectId = text(body.subjectId, 128);
    if (!title || !subjectId || !topic || typeof body.published !== "boolean" || !Array.isArray(body.cards) || !body.cards.length || body.cards.length > MAX_CARDS) throw new Error("Set a title, subject, topic and 1–500 complete cards.");
    if (body.id && (typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id))) throw new Error("Invalid deck ID");
    const subject = await adminDb.collection("subjects").doc(subjectId).get();
    const subjectData = subject.data();
    if (!subjectData || !["FLK 1", "FLK 2"].includes(subjectData.track)) throw new Error("Choose an existing FLK subject.");
    const seen = new Set<string>();
    const cards = body.cards.map((value: unknown, index: number) => {
      let card;
      try { card = normalizeFlashcard(value); }
      catch (error) { throw new Error(`Card ${index + 1}: ${error instanceof Error ? error.message : "Invalid card"}`); }
      const key = card.question.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) throw new Error(`Card ${index + 1}: duplicate question.`);
      seen.add(key);
      return card;
    });
    const collection = adminDb.collection(FLASHCARD_COLLECTION);
    const ref = body.id ? collection.doc(body.id) : collection.doc();
    await ref.set({ title, topic, subjectId, subjectName: subjectData.name, track: subjectData.track, published: body.published, cards, cardCount: cards.length, updatedAt: new Date().toISOString(), updatedBy: admin.uid });
    return NextResponse.json({ id: ref.id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 }); }
}
export async function DELETE(request: NextRequest) {
  try { await verifyAdminRequest(request); } catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[\w-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid deck ID" }, { status: 400 });
  await adminDb.collection(FLASHCARD_COLLECTION).doc(id).delete();
  return NextResponse.json({ success: true });
}
