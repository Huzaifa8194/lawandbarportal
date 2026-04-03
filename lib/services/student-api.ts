"use client";

import { auth } from "@/lib/firebase";
import type { Mcq, MockExam } from "@/lib/types/admin";

async function headers() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: await headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload as T;
}

export const studentApi = {
  listAttempts: () => request("/api/student/attempts"),
  createAttempt: (payload: unknown) => request("/api/student/attempts", "POST", payload),
  getMockSession: (mockId: string) =>
    request<{ mock: MockExam; questions: Mcq[] }>(`/api/student/mocks/${encodeURIComponent(mockId)}`),
  getPdfState: (bookId: string) => request(`/api/student/pdf/${bookId}`),
  savePdfState: (bookId: string, payload: unknown) =>
    request(`/api/student/pdf/${bookId}`, "PUT", payload),
  getAudioState: (audioId: string) => request(`/api/student/audio/${audioId}`),
  saveAudioState: (audioId: string, payload: unknown) =>
    request(`/api/student/audio/${audioId}`, "PUT", payload),
};
