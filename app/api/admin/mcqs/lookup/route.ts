import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

const MAX_IDS = 200;
const GET_ALL_CHUNK = 10;

export async function POST(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const body = (await request.json()) as { ids?: unknown };
    const raw = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))].slice(0, MAX_IDS);
    if (!ids.length) {
      return NextResponse.json({ items: [] as unknown[] });
    }

    const col = adminDb.collection("mcqs");
    const items: Record<string, unknown>[] = [];

    for (let i = 0; i < ids.length; i += GET_ALL_CHUNK) {
      const chunk = ids.slice(i, i + GET_ALL_CHUNK);
      const refs = chunk.map((id) => col.doc(id));
      const snaps = await adminDb.getAll(...refs);
      for (const snap of snaps) {
        if (snap.exists) {
          items.push({ ...snap.data(), id: snap.id });
        }
      }
    }

    const order = new Map(ids.map((id, idx) => [id, idx]));
    items.sort((a, b) => {
      const ia = order.get(String((a as { id?: string }).id)) ?? 9999;
      const ib = order.get(String((b as { id?: string }).id)) ?? 9999;
      return ia - ib;
    });

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
