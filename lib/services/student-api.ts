"use client";

import { auth } from "@/lib/firebase";
import type { FlashcardDeck } from "@/lib/flashcards";
import type { Mcq, MockExam } from "@/lib/types/admin";
import type { PaginatedAttemptsResponse, StudentAttempt } from "@/lib/types/student";

async function headers() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(url: string, method = "GET", body?: unknown, timeoutMs?: number): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: await headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Request failed (HTTP ${response.status})`);
  return payload as T;
}

export const studentApi = {
  listFlashcards: () => request<FlashcardDeck[]>("/api/student/flashcards"),
  getFlashcards: (id: string) => request<FlashcardDeck>(`/api/student/flashcards?id=${encodeURIComponent(id)}`),
  listAttempts: (params?: { page?: number; pageSize?: number }) => {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set("page", String(params.page));
    if (params?.pageSize != null) sp.set("pageSize", String(params.pageSize));
    const qs = sp.toString();
    return request<PaginatedAttemptsResponse>(`/api/student/attempts${qs ? `?${qs}` : ""}`);
  },
  getAttempt: (attemptId: string) =>
    request<StudentAttempt>(`/api/student/attempts/${encodeURIComponent(attemptId)}`),
  createAttempt: (payload: unknown) => request("/api/student/attempts", "POST", payload),
  getMockSession: (mockId: string) =>
    request<{ mock: MockExam; questions: Mcq[] }>(`/api/student/mocks/${encodeURIComponent(mockId)}`),
  getPdfState: (bookId: string) => request(`/api/student/pdf/${bookId}`, "GET", undefined, 25_000),
  savePdfState: (bookId: string, payload: unknown) =>
    request(`/api/student/pdf/${bookId}`, "PUT", payload, 25_000),
  getAudioState: (audioId: string) => request(`/api/student/audio/${audioId}`),
  saveAudioState: (audioId: string, payload: unknown) =>
    request(`/api/student/audio/${audioId}`, "PUT", payload),
};
