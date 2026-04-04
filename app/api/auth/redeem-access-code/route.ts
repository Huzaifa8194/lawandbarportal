import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getPortalAccessState } from "@/app/api/_lib/portal-access";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAccessCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function expiresAtDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

type AccessCodeDoc = {
  code?: string;
  email?: string | null;
  active?: boolean;
  expiresAt?: unknown;
  uid?: string | null;
  usedAt?: string | null;
};

/**
 * Redeems an admin-generated access code for the signed-in student (Bearer Firebase ID token).
 * Aligns with `access_codes` created in Admin → Students & Access.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing bearer token", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const tokenEmail = typeof decoded.email === "string" ? normalizeEmail(decoded.email) : "";

    const body = (await request.json()) as { code?: string };
    const normalizedCode = typeof body.code === "string" ? normalizeAccessCode(body.code) : "";
    if (!normalizedCode || normalizedCode.length < 4) {
      return NextResponse.json(
        { error: "Enter the access code exactly as provided.", code: "INVALID_FORMAT" },
        { status: 400 },
      );
    }

    const prior = await getPortalAccessState(uid);
    if (prior.allowed) {
      return NextResponse.json({ ok: true, alreadyActive: true });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Your account profile is not ready yet. Contact support.", code: "NO_USER_DOC" },
        { status: 400 },
      );
    }

    const userData = userSnap.data() as { accessEnabled?: boolean; email?: string };
    if (userData.accessEnabled === false) {
      return NextResponse.json(
        { error: "Portal access has been disabled for this account. Contact support.", code: "ADMIN_DISABLED" },
        { status: 403 },
      );
    }

    const profileEmail =
      tokenEmail || (typeof userData.email === "string" ? normalizeEmail(userData.email) : "");

    const matchSnap = await adminDb.collection("access_codes").where("code", "==", normalizedCode).limit(1).get();

    if (matchSnap.empty) {
      return NextResponse.json(
        { error: "That code was not found. Check for typos or request a new code from support.", code: "INVALID_CODE" },
        { status: 404 },
      );
    }

    const codeRef = matchSnap.docs[0].ref;

    await adminDb.runTransaction(async (tx) => {
      const [freshCode, freshUser] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);

      if (!freshUser.exists) {
        throw Object.assign(new Error("NO_USER_DOC"), { redeemCode: "NO_USER_DOC" });
      }

      const u = freshUser.data() as { accessEnabled?: boolean; email?: string };
      if (u.accessEnabled === false) {
        throw Object.assign(new Error("ADMIN_DISABLED"), { redeemCode: "ADMIN_DISABLED" });
      }

      const c = freshCode.data() as AccessCodeDoc;
      if (!c || c.active === false) {
        throw Object.assign(new Error("ALREADY_USED"), { redeemCode: "ALREADY_USED" });
      }

      const exp = expiresAtDate(c.expiresAt);
      if (exp && exp.getTime() < Date.now()) {
        throw Object.assign(new Error("EXPIRED"), { redeemCode: "EXPIRED" });
      }

      const locked = typeof c.email === "string" && c.email.trim() ? normalizeEmail(c.email) : "";
      const userEm =
        profileEmail ||
        (typeof u.email === "string" ? normalizeEmail(u.email) : "");
      if (locked && (!userEm || locked !== userEm)) {
        throw Object.assign(new Error("EMAIL_LOCK"), { redeemCode: "EMAIL_LOCK" });
      }

      if (c.uid && c.uid !== uid) {
        throw Object.assign(new Error("ALREADY_USED"), { redeemCode: "ALREADY_USED" });
      }

      const now = new Date().toISOString();
      tx.update(codeRef, {
        active: false,
        usedAt: now,
        uid,
      });
      tx.set(
        userRef,
        {
          portalAccessViaCode: true,
          portalAccessCodeRedeemedAt: now,
          portalAccessCodeId: codeRef.id,
        },
        { merge: true },
      );
    });

    const state = await getPortalAccessState(uid);
    return NextResponse.json({
      ok: true,
      allowed: state.allowed,
      isAdmin: state.isAdmin,
      reason: state.reason,
    });
  } catch (error) {
    const redeemCode =
      error !== null && typeof error === "object" && "redeemCode" in error
        ? String((error as { redeemCode: unknown }).redeemCode)
        : undefined;

    if (redeemCode === "NO_USER_DOC") {
      return NextResponse.json(
        { error: "Your account profile is not ready yet. Contact support.", code: "NO_USER_DOC" },
        { status: 400 },
      );
    }
    if (redeemCode === "ADMIN_DISABLED") {
      return NextResponse.json(
        { error: "Portal access has been disabled for this account. Contact support.", code: "ADMIN_DISABLED" },
        { status: 403 },
      );
    }
    if (redeemCode === "ALREADY_USED") {
      return NextResponse.json(
        {
          error: "This code has already been used or is no longer valid. Request a new code if you still need access.",
          code: "ALREADY_USED",
        },
        { status: 409 },
      );
    }
    if (redeemCode === "EXPIRED") {
      return NextResponse.json(
        { error: "This access code has expired. Contact support for a replacement.", code: "EXPIRED" },
        { status: 400 },
      );
    }
    if (redeemCode === "EMAIL_LOCK") {
      return NextResponse.json(
        {
          error:
            "This code is locked to a different email address. Sign in with the email your administrator assigned, or contact support.",
          code: "EMAIL_LOCK",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Redeem failed", code: "UNKNOWN" },
      { status: 500 },
    );
  }
}
