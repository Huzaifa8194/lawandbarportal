import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PORTAL_BOOKS_COLLECTION } from "@/lib/portal-collections";
import {
  type LegacyExamDoc,
  legacyExamDocToMockExam,
  userCanAccessLegacyExam,
} from "@/lib/legacy-exam-adapters";
import type {
  AccessCode,
  Attempt,
  AudioLesson,
  Book,
  Mcq,
  MockExam,
  Subject,
  UserProfile,
  VideoLesson,
} from "@/lib/types/admin";

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

async function listCollection<T>(name: string): Promise<T[]> {
  const snapshot = await getDocs(query(collection(db, name)));
  // Ensure Firestore document id always wins over any stale `id` field stored in data.
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return null;
  return { uid, ...(snapshot.data() as Omit<UserProfile, "uid">) };
}

export async function listStudents(): Promise<UserProfile[]> {
  const rows = await listCollection<UserProfile>("users");
  return rows.filter((row) => !row.isAdmin);
}

export async function listSubjects(): Promise<Subject[]> {
  return listCollection<Subject>("subjects");
}

export async function listBooks(): Promise<Book[]> {
  const rows = await listCollection<Book>(PORTAL_BOOKS_COLLECTION);
  return rows.map((row) => ({ ...row, updatedAt: normalizeDate(row.updatedAt) }));
}

export async function listAudios(): Promise<AudioLesson[]> {
  const rows = await listCollection<AudioLesson>("audios");
  return rows.map((row) => ({ ...row, updatedAt: normalizeDate(row.updatedAt) }));
}

export async function listVideos(): Promise<VideoLesson[]> {
  const rows = await listCollection<VideoLesson>("videos");
  return rows.map((row) => ({ ...row, updatedAt: normalizeDate(row.updatedAt) }));
}

export async function listMcqs(): Promise<Mcq[]> {
  const rows = await listCollection<Mcq>("mcqs");
  return rows.map((row) => ({ ...row, updatedAt: normalizeDate(row.updatedAt) }));
}

export async function listMockExams(): Promise<MockExam[]> {
  const rows = await listCollection<MockExam>("mock_exams");
  return rows.map((row) => ({ ...row, updatedAt: normalizeDate(row.updatedAt) }));
}

/** Same book-order sources as Main website `mock-exams` page (client-side). */
async function fetchPurchasedBookIdsClient(emailRaw: string): Promise<Set<string>> {
  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();
  const ids = new Set<string>();
  if (!email) return ids;

  try {
    const boSnap = await getDocs(query(collection(db, "bookorders"), where("userId", "==", email)));
    boSnap.forEach((d) => {
      const bookId = d.data()?.bookId;
      if (typeof bookId === "string" && bookId) ids.add(bookId);
    });
  } catch {
    // ignore
  }

  try {
    const bO2Snap = await getDocs(query(collection(db, "bookOrders"), where("userEmail", "==", email)));
    bO2Snap.forEach((d) => {
      const bookId = d.data()?.bookId;
      if (typeof bookId === "string" && bookId) ids.add(bookId);
    });
  } catch {
    // ignore
  }

  return ids;
}

/**
 * Portal `mock_exams` plus legacy Main website `exams`, with the same FLK / purchase rules as `/mock-exams`.
 */
export async function listMergedMockExamsForStudent(user: { uid: string; email: string | null } | null): Promise<MockExam[]> {
  const portalMocks = (await listMockExams()).filter((m) => m.published);
  const emailRaw = user?.email ?? "";
  if (!user || !emailRaw.trim()) {
    return portalMocks;
  }
  const emailNormalized = emailRaw.trim().toLowerCase();

  let legacyMocks: MockExam[] = [];
  try {
    const purchased = await fetchPurchasedBookIdsClient(emailRaw);
    const examsSnap = await getDocs(query(collection(db, "exams")));
    legacyMocks = examsSnap.docs
      .map((d) => {
        const data = d.data() as LegacyExamDoc;
        if (data.published === false) return null;
        if (!userCanAccessLegacyExam(user.uid, emailNormalized, purchased, data)) return null;
        const row = legacyExamDocToMockExam(d.id, data);
        if (!row.questionIds.length) return null;
        return row;
      })
      .filter((m): m is MockExam => m != null);
  } catch {
    legacyMocks = [];
  }

  const portalIds = new Set(portalMocks.map((m) => m.id));
  const dedupedLegacy = legacyMocks.filter((m) => !portalIds.has(m.id));

  const merged = [...portalMocks, ...dedupedLegacy];
  merged.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return tb - ta;
  });
  return merged;
}

export async function listAccessCodes(): Promise<AccessCode[]> {
  const rows = await listCollection<AccessCode>("access_codes");
  return rows.map((row) => ({
    ...row,
    expiresAt: normalizeDate(row.expiresAt),
    usedAt: normalizeDate(row.usedAt),
  }));
}

export async function listAttemptsByUser(userId: string): Promise<Attempt[]> {
  const attemptsRef = collection(db, "attempts");
  const snapshot = await getDocs(query(attemptsRef, orderBy("createdAt", "desc"), limit(30)));
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }) as Attempt)
    .filter((item) => item.userId === userId)
    .map((item) => ({ ...item, createdAt: normalizeDate(item.createdAt) }));
}
