/**
 * `mock_exams.questionIds` may be stored as plain string IDs or Firestore
 * DocumentReferences (Admin SDK or client SDK). Only strings work with
 * `collection("mcqs").doc(id)`; refs must be coerced via `.id` or path.
 */
function coerceMcqDocId(entry: unknown): string | null {
  if (typeof entry === "string") {
    const t = entry.trim();
    return t.length ? t : null;
  }
  if (typeof entry === "number" && Number.isFinite(entry)) {
    return String(entry);
  }
  if (typeof entry === "bigint") {
    return String(entry);
  }
  if (!entry || typeof entry !== "object") return null;
  const o = entry as { id?: unknown; path?: unknown };
  if (typeof o.id === "string" && o.id.length > 0) return o.id;
  if (typeof o.path === "string") {
    const seg = o.path.split("/").filter(Boolean);
    const last = seg[seg.length - 1];
    if (last) return last;
  }
  return null;
}

export function normalizeMockQuestionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const id = coerceMcqDocId(entry);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
