import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const rows = await listCollection<Book>("books");
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
