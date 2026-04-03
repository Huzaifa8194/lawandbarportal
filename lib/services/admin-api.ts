"use client";

import { auth } from "@/lib/firebase";

async function getHeaders() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const headers = await getHeaders();
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  listStudents: () => request("/api/admin/students"),
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
  listMcqs: () => request("/api/admin/mcqs"),
  upsertMcq: (payload: unknown) => request("/api/admin/mcqs", "POST", payload),
  deleteMcq: (id: string) => request(`/api/admin/mcqs/${id}`, "DELETE"),
  listMocks: () => request("/api/admin/mocks"),
  upsertMock: (payload: unknown) => request("/api/admin/mocks", "POST", payload),
  deleteMock: (id: string) => request(`/api/admin/mocks/${id}`, "DELETE"),
  logAudit: (payload: unknown) => request("/api/admin/audit", "POST", payload),
};
