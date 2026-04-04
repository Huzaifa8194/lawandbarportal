import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb.collection("access_codes").orderBy("createdAt", "desc").get();
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
    const body = (await request.json()) as { email?: string; expiresAt?: string };
    const code = `LB-${randomUUID().slice(0, 8).toUpperCase()}`;
    const docRef = await adminDb.collection("access_codes").add({
      code,
      email: body.email ?? null,
      active: true,
      createdBy: admin.uid,
      createdAt: new Date().toISOString(),
      expiresAt: body.expiresAt ?? null,
    });
    return NextResponse.json({ id: docRef.id, code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
