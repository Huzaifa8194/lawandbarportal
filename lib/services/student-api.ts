"use client";

import { auth } from "@/lib/firebase";
import type { FlashcardDeck } from "@/lib/flashcards";
import type { Mcq, MockExam } from "@/lib/types/admin";
import type { PaginatedAttemptsResponse, PdfStudyState, StudentAttempt } from "@/lib/types/student";

async function headers(refresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken(refresh);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getPdfState(bookId: string, signal?: AbortSignal): Promise<PdfStudyState | null> {
  const url = `/api/student/pdf/${encodeURIComponent(bookId)}`;
  for (let attempt = 0; ; attempt++) {
    const deadline = AbortSignal.timeout(30_000);
    try {
      const response = await fetch(url, {
        headers: await headers(attempt > 0),
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (attempt === 0 && (response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500)) continue;
        const reference = response.headers.get("X-Request-Id");
        const message = reference && typeof payload?.error === "string" ? payload.error : "Saved study tools could not be loaded.";
        throw new Error(reference ? `${message} Support reference: ${reference}` : message);
      }
      const saved = await response.json();
      if (saved === null || (typeof saved === "object" && !Array.isArray(saved) && typeof saved.id === "string")) return saved;
      throw new Error("The saved study response was invalid. Please retry.");
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (deadline.aborted || error instanceof TypeError) {
        if (attempt === 0) continue;
        throw new Error(deadline.aborted ? "Loading saved study tools timed out." : "The connection dropped while loading saved study tools.");
      }
      if (error instanceof SyntaxError) throw new Error("The study tools service returned an unreadable response. Please retry.");
      throw error;
    }
  }
}

async function request<T>(url: string, method = "GET", body?: unknown, timeoutMs?: number): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: await headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Request failed (HTTP ${response.status})`);
  }
  return await response.json() as T;
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
  getPdfState,
  savePdfState: (bookId: string, payload: unknown) =>
    request(`/api/student/pdf/${encodeURIComponent(bookId)}`, "PUT", payload, 25_000),
  getAudioState: (audioId: string) => request(`/api/student/audio/${audioId}`),
  saveAudioState: (audioId: string, payload: unknown) =>
    request(`/api/student/audio/${audioId}`, "PUT", payload),
};
