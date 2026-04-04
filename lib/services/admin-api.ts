"use client";

import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import type { AdminMcqListResponse, Mcq, StudentAccessDebugResponse } from "@/lib/types/admin";
import { auth } from "@/lib/firebase";

/**
 * `auth.currentUser` is often null for a tick after mount while Firebase restores
 * the session. Admin pages call APIs in useEffect([]) before that resolves — wait once.
 */
async function getAuthUserReady(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

async function getHeaders() {
  const user = await getAuthUserReady();
  if (!user) {
    throw new Error("Not authenticated");
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const headers = await getHeaders();
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await parseResponseBody(response)) as T & { error?: string };
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const adminApi = {
  listStudents: () => request("/api/admin/students"),
  getStudentAccessDebug: (uid: string) => request<StudentAccessDebugResponse>(`/api/admin/students/${uid}/access-debug`),
  updateStudentAccess: (uid: string, accessEnabled: boolean) =>
    request(`/api/admin/students/${uid}/access`, "PATCH", { accessEnabled }),
  listAccessCodes: () => request("/api/admin/access-codes"),
  createAccessCode: (payload: { email?: string; expiresAt?: string }) =>
    request("/api/admin/access-codes", "POST", payload),
  listSubjects: () => request("/api/admin/subjects"),
  upsertSubject: (payload: unknown) => request("/api/admin/subjects", "POST", payload),
  listBooks: () => request("/api/admin/books"),
  upsertBook: (payload: unknown) => request("/api/admin/books", "POST", payload),
  deleteBook: (id: string) => request(`/api/admin/books/${id}`, "DELETE"),
  listAudios: () => request("/api/admin/audios"),
  upsertAudio: (payload: unknown) => request("/api/admin/audios", "POST", payload),
  deleteAudio: (id: string) => request(`/api/admin/audios/${id}`, "DELETE"),
  listVideos: () => request("/api/admin/videos"),
  upsertVideo: (payload: unknown) => request("/api/admin/videos", "POST", payload),
  deleteVideo: (id: string) => request(`/api/admin/videos/${id}`, "DELETE"),
  listMcqs: (query?: {
    limit?: number;
    cursor?: string;
    q?: string;
    track?: string;
    subjectId?: string;
    published?: "true" | "false";
  }) => {
    const sp = new URLSearchParams();
    if (query?.limit != null) sp.set("limit", String(query.limit));
    if (query?.cursor) sp.set("cursor", query.cursor);
    if (query?.q) sp.set("q", query.q);
    if (query?.track) sp.set("track", query.track);
    if (query?.subjectId) sp.set("subjectId", query.subjectId);
    if (query?.published) sp.set("published", query.published);
    const qs = sp.toString();
    return request<AdminMcqListResponse>(qs ? `/api/admin/mcqs?${qs}` : "/api/admin/mcqs");
  },
  lookupMcqsByIds: (ids: string[]) =>
    request<{ items: Mcq[] }>("/api/admin/mcqs/lookup", "POST", { ids }),
  upsertMcq: (payload: unknown) => request("/api/admin/mcqs", "POST", payload),
  deleteMcq: (id: string) => request(`/api/admin/mcqs/${id}`, "DELETE"),
  listMocks: () => request("/api/admin/mocks"),
  upsertMock: (payload: unknown) => request("/api/admin/mocks", "POST", payload),
  deleteMock: (id: string) => request(`/api/admin/mocks`, "DELETE", { id }),
  logAudit: (payload: unknown) => request("/api/admin/audit", "POST", payload),
};
