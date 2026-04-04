import { NextResponse } from "next/server";

/** Map thrown errors from student routes to HTTP status (avoid masking Firestore failures as 403). */
export function studentRouteErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Request failed";
  if (message === "Missing bearer token") {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  if (message === "Access denied") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}
