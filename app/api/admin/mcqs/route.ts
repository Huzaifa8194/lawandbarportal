import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

const MCQ_COLLECTION = "mcqs";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 40;

type McqRow = Record<string, unknown> & { id: string };

function sortRowsByUpdatedAtDesc(rows: McqRow[]) {
  return [...rows].sort((a, b) => {
    const ta = typeof a.updatedAt === "string" ? Date.parse(a.updatedAt) : 0;
    const tb = typeof b.updatedAt === "string" ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const { searchParams } = new URL(request.url);
    const qText = searchParams.get("q")?.trim() ?? "";
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam)
      ? Math.min(MAX_LIMIT, Math.max(1, limitParam))
      : DEFAULT_LIMIT;
    const cursor = searchParams.get("cursor")?.trim() ?? "";
    const track = searchParams.get("track")?.trim() ?? "";
    const subjectId = searchParams.get("subjectId")?.trim() ?? "";
    const publishedParam = searchParams.get("published");

    const col = adminDb.collection(MCQ_COLLECTION);

    // Substring search: scans the collection (acceptable for admin-only banks up to a few thousand docs).
    if (qText.length >= 2) {
      const snap = await col.get();
      const needle = qText.toLowerCase();
      let rows: McqRow[] = snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));

      if (track === "FLK 1" || track === "FLK 2") {
        rows = rows.filter((r) => String(r.track ?? "") === track);
      }
      if (subjectId) {
        rows = rows.filter((r) => String(r.subjectId ?? "") === subjectId);
      }
      if (publishedParam === "true") rows = rows.filter((r) => r.published === true);
      if (publishedParam === "false") rows = rows.filter((r) => r.published === false);

      rows = rows.filter((r) => String(r.question ?? "").toLowerCase().includes(needle));
      rows = sortRowsByUpdatedAtDesc(rows);

      return NextResponse.json({
        items: rows.slice(0, limit),
        nextCursor: null as string | null,
        hasMore: rows.length > limit,
        mode: "search" as const,
        totalMatched: rows.length,
      });
    }

    let queryRef = col.orderBy("updatedAt", "desc");
    if (track === "FLK 1" || track === "FLK 2") {
      queryRef = queryRef.where("track", "==", track);
    }
    if (subjectId) {
      queryRef = queryRef.where("subjectId", "==", subjectId);
    }
    if (publishedParam === "true") {
      queryRef = queryRef.where("published", "==", true);
    } else if (publishedParam === "false") {
      queryRef = queryRef.where("published", "==", false);
    }

    queryRef = queryRef.limit(limit + 1);
    if (cursor) {
      const cur = await col.doc(cursor).get();
      if (cur.exists) {
        queryRef = queryRef.startAfter(cur);
      }
    }

    const snapshot = await queryRef.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;
    const items: McqRow[] = pageDocs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
    const nextCursor = hasMore && pageDocs.length ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({
      items,
      nextCursor,
      hasMore,
      mode: "page" as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const isIndexError =
      typeof message === "string" &&
      (message.includes("index") || message.includes("The query requires an index"));
    return NextResponse.json(
      {
        error: isIndexError
          ? `${message} Create the suggested composite index in Firebase Console (Firestore → Indexes), or temporarily clear filters and use search only.`
          : message,
      },
      { status: isIndexError ? 400 : 403 },
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
      question: string;
      options: string[];
      correctOption: number;
      explanation: string;
      published: boolean;
    };
    if (body.options.length !== 5) {
      return NextResponse.json({ error: "Exactly 5 options are required." }, { status: 400 });
    }
    const col = adminDb.collection(MCQ_COLLECTION);
    const target = body.id ? col.doc(body.id) : col.doc();
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
