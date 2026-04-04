import { NextRequest, NextResponse } from "next/server";
import { verifyStudentRequest } from "../_lib/auth";
import { studentRouteErrorResponse } from "../_lib/http-error";
import { adminDb } from "@/lib/firebase-admin";

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function createdAtSortKey(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

const MAX_PAGE_SIZE = 100;

function paginationMeta(
  page: number,
  pageSize: number,
  total: number,
): {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    /**
     * Do not use orderBy("createdAt") with where("userId"): that needs a composite index.
     * Without it Firestore throws; the old handler returned 403 for every error, so the
     * dashboard looked "blocked" while POST createAttempt still worked.
     * Fetch all rows for this user (typical volume is small), sort newest-first in memory.
     */
    const snapshot = await adminDb.collection("attempts").where("userId", "==", uid).get();
    const rows = snapshot.docs
      .map((item) => {
        const data = item.data();
        return {
          ...data,
          id: item.id,
          createdAt: normalizeDate(data.createdAt) ?? data.createdAt,
        };
      })
      .sort((a, b) => createdAtSortKey(b.createdAt) - createdAtSortKey(a.createdAt));

    const total = rows.length;
    const pageSizeRaw = request.nextUrl.searchParams.get("pageSize");
    const pageRaw = request.nextUrl.searchParams.get("page");

    if (pageSizeRaw != null && pageSizeRaw !== "") {
      let pageSize = Number.parseInt(pageSizeRaw, 10);
      if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 10;
      pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
      let page = Number.parseInt(pageRaw ?? "1", 10);
      if (!Number.isFinite(page) || page < 1) page = 1;
      const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
      page = Math.min(page, totalPages);
      const start = (page - 1) * pageSize;
      const data = rows.slice(start, start + pageSize);
      return NextResponse.json({
        data,
        pagination: paginationMeta(page, pageSize, total),
      });
    }

    return NextResponse.json({
      data: rows,
      pagination: {
        page: 1,
        pageSize: total,
        total,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { uid } = await verifyStudentRequest(request);
    const body = await request.json();
    const docRef = await adminDb.collection("attempts").add({
      ...body,
      userId: uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error) {
    return studentRouteErrorResponse(error);
  }
}
