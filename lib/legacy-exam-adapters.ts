import type { FlkTrack, Mcq, MockExam } from "@/lib/types/admin";

function coerceIsoDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Shape of embedded questions on Main website `exams` documents. */
export type LegacyExamQuestion = {
  id?: string;
  text?: string;
  reason?: string;
  whyWrong?: string;
  options?: Array<{ id?: string; text?: string; isCorrect?: boolean }>;
};

export type LegacyExamDoc = {
  title?: string;
  duration?: string;
  questions?: LegacyExamQuestion[];
  flkGroup?: string;
  linkedSqeItemId?: string;
  specialAccessUserIds?: string[];
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** Maps Main website `flkGroup` to portal track labels (with spaces). */
export function legacyFlkGroupToTrack(flkGroup: unknown): FlkTrack | "Free" {
  const g = typeof flkGroup === "string" ? flkGroup.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (g === "FLK1") return "FLK 1";
  if (g === "FLK2") return "FLK 2";
  return "Free";
}

/** Parses values like "90 minutes", "90", 90 → minutes. */
export function parseExamDurationMinutes(duration: unknown): number {
  if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
    return Math.min(Math.round(duration), 24 * 60);
  }
  const s = typeof duration === "string" ? duration : "";
  const match = s.match(/(\d+)/);
  const n = match ? parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 90;
  return Math.min(n, 24 * 60);
}

export function legacyMcqStableId(examId: string, question: LegacyExamQuestion | undefined, index: number): string {
  const raw = typeof question?.id === "string" && question.id.trim() ? question.id.trim() : "";
  const seg = raw
    ? raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96)
    : `i${index}`;
  return `legacy_${examId}_${seg}`;
}

export function legacyQuestionToMcq(
  examId: string,
  question: LegacyExamQuestion,
  index: number,
  track: FlkTrack,
): Mcq {
  const id = legacyMcqStableId(examId, question, index);
  const rawOpts = Array.isArray(question.options) ? question.options : [];
  const texts = rawOpts.map((o) => (typeof o.text === "string" ? o.text : ""));
  const padded: [string, string, string, string, string] = ["", "", "", "", ""];
  for (let i = 0; i < 5; i++) padded[i] = texts[i] ?? "";

  let correctOption = rawOpts.findIndex((o) => o.isCorrect === true);
  if (correctOption < 0) correctOption = 0;
  if (correctOption > 4) correctOption = 4;

  const explanation =
    [typeof question.reason === "string" ? question.reason.trim() : "", typeof question.whyWrong === "string" ? question.whyWrong.trim() : ""]
      .filter(Boolean)
      .join("\n\n") || "";

  return {
    id,
    subjectId: "legacy",
    subjectName: "Legacy mock",
    track,
    question: typeof question.text === "string" ? question.text : "",
    options: padded,
    correctOption,
    explanation,
    published: true,
  };
}

export function legacyExamDocToMockExam(docId: string, data: LegacyExamDoc): MockExam {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const track = legacyFlkGroupToTrack(data.flkGroup);
  const questionIds = questions.map((q, i) => legacyMcqStableId(docId, q, i));

  return {
    id: docId,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled mock",
    track,
    subjectIds: [],
    questionIds,
    durationMinutes: parseExamDurationMinutes(data.duration),
    examMode: true,
    revealAnswersInPractice: true,
    published: data.published !== false,
    updatedAt: coerceIsoDate(data.updatedAt),
    createdAt: coerceIsoDate(data.createdAt),
  };
}

export function legacyExamToSession(docId: string, data: LegacyExamDoc): { mock: MockExam; questions: Mcq[] } {
  const mock = legacyExamDocToMockExam(docId, data);
  const flkForMcq: FlkTrack = mock.track === "Free" ? "FLK 1" : mock.track;
  const questions = (Array.isArray(data.questions) ? data.questions : []).map((q, i) =>
    legacyQuestionToMcq(docId, q, i, flkForMcq),
  );
  return { mock, questions };
}

export function userCanAccessLegacyExam(
  uid: string,
  emailLower: string,
  purchasedBookIds: Set<string>,
  data: LegacyExamDoc,
): boolean {
  const ids = Array.isArray(data.specialAccessUserIds) ? data.specialAccessUserIds : [];
  if (ids.includes(uid)) return true;

  const linked = typeof data.linkedSqeItemId === "string" ? data.linkedSqeItemId.trim() : "";
  if (!linked) return true;

  return purchasedBookIds.has(linked);
}
