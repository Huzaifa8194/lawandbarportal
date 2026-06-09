import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../_lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { PORTAL_UPDATES_COLLECTION } from "@/lib/portal-collections";
import { deleteStoragePaths, uniquePaths } from "./_lib/storage";

type UpdatePayload = {
  id?: string;
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  coverImagePath?: string;
  imagePaths?: string[];
  published: boolean;
};

function validatePayload(body: UpdatePayload) {
  if (!body.title?.trim()) {
    throw new Error("Title is required");
  }
  if (!body.content?.trim()) {
    throw new Error("Content is required");
  }
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request);
    const snapshot = await adminDb
      .collection(PORTAL_UPDATES_COLLECTION)
      .orderBy("updatedAt", "desc")
      .get();
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
    const body = (await request.json()) as UpdatePayload;
    validatePayload(body);

    const now = new Date().toISOString();
    const target = body.id
      ? adminDb.collection(PORTAL_UPDATES_COLLECTION).doc(body.id)
      : adminDb.collection(PORTAL_UPDATES_COLLECTION).doc();

    const existingSnap = body.id ? await target.get() : null;
    const existing = existingSnap?.exists ? existingSnap.data() : null;

    const nextImagePaths = uniquePaths(body.imagePaths, body.coverImagePath);
    const previousImagePaths = uniquePaths(
      existing?.imagePaths as string[] | undefined,
      existing?.coverImagePath as string | undefined,
    );
    const removedPaths = previousImagePaths.filter((path) => !nextImagePaths.includes(path));
    await deleteStoragePaths(removedPaths);

    const payload = {
      title: body.title.trim(),
      excerpt: body.excerpt?.trim() || "",
      content: body.content,
      coverImageUrl: body.coverImageUrl || "",
      coverImagePath: body.coverImagePath || "",
      imagePaths: nextImagePaths,
      published: Boolean(body.published),
      updatedBy: admin.uid,
      updatedAt: now,
      createdAt: (existing?.createdAt as string | undefined) || now,
    };

    await target.set(payload, { merge: true });
    return NextResponse.json({ id: target.id, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403 },
    );
  }
}
