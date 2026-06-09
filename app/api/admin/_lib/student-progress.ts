import type { Firestore } from "firebase-admin/firestore";

export type StudentProgressSummary = {
  mockAttempts: number;
  examAttempts: number;
  bestMockScore: number | null;
  averageMockScore: number | null;
  booksEngaged: number;
  audiosPlayed: number;
  lastActivityAt: string | null;
};

type AttemptRow = {
  userId?: string;
  score?: number;
  mode?: string;
  createdAt?: string;
};

type StateRow = {
  userId?: string;
  updatedAt?: string;
  currentSeconds?: number;
};

function parseIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function uidFromCompositeDocId(docId: string): string | null {
  const idx = docId.indexOf("_");
  if (idx <= 0) return null;
  return docId.slice(0, idx);
}

function emptyProgress(): StudentProgressSummary {
  return {
    mockAttempts: 0,
    examAttempts: 0,
    bestMockScore: null,
    averageMockScore: null,
    booksEngaged: 0,
    audiosPlayed: 0,
    lastActivityAt: null,
  };
}

function bumpLastActivity(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

export async function buildStudentProgressMap(
  db: Firestore,
  studentUids: string[],
): Promise<Map<string, StudentProgressSummary>> {
  const uidSet = new Set(studentUids);
  const map = new Map<string, StudentProgressSummary>();
  for (const uid of studentUids) {
    map.set(uid, emptyProgress());
  }
  if (!studentUids.length) return map;

  const [attemptsSnap, pdfSnap, audioSnap] = await Promise.all([
    db.collection("attempts").get(),
    db.collection("pdf_state").get(),
    db.collection("audio_state").get(),
  ]);

  const attemptScores = new Map<string, number[]>();

  for (const doc of attemptsSnap.docs) {
    const row = doc.data() as AttemptRow;
    const uid = row.userId;
    if (!uid || !uidSet.has(uid)) continue;

    const summary = map.get(uid)!;
    summary.mockAttempts += 1;
    if ((row.mode ?? "practice") === "exam") {
      summary.examAttempts += 1;
    }
    if (typeof row.score === "number" && Number.isFinite(row.score)) {
      const scores = attemptScores.get(uid) ?? [];
      scores.push(row.score);
      attemptScores.set(uid, scores);
    }
    summary.lastActivityAt = bumpLastActivity(summary.lastActivityAt, parseIso(row.createdAt));
  }

  for (const [uid, scores] of attemptScores) {
    const summary = map.get(uid);
    if (!summary || !scores.length) continue;
    summary.bestMockScore = Math.max(...scores);
    summary.averageMockScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  for (const doc of pdfSnap.docs) {
    const row = doc.data() as StateRow;
    const uid = row.userId || uidFromCompositeDocId(doc.id);
    if (!uid || !uidSet.has(uid)) continue;
    const updatedAt = parseIso(row.updatedAt);
    if (!updatedAt) continue;

    const summary = map.get(uid)!;
    summary.booksEngaged += 1;
    summary.lastActivityAt = bumpLastActivity(summary.lastActivityAt, updatedAt);
  }

  for (const doc of audioSnap.docs) {
    const row = doc.data() as StateRow;
    const uid = row.userId || uidFromCompositeDocId(doc.id);
    if (!uid || !uidSet.has(uid)) continue;
    const updatedAt = parseIso(row.updatedAt);
    const played = Boolean(updatedAt) || (row.currentSeconds ?? 0) > 0;
    if (!played) continue;

    const summary = map.get(uid)!;
    summary.audiosPlayed += 1;
    summary.lastActivityAt = bumpLastActivity(summary.lastActivityAt, updatedAt);
  }

  return map;
}
