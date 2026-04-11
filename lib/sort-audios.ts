/**
 * Order audio lessons in teaching sequence: "Chapter 2" before "Chapter 10",
 * "Topic 1" before "Topic 2", etc. Uses labeled patterns first, then any number
 * in the title, then alphabetical fallback for titles without digits.
 */

const LABELED_INDEX =
  /\b(?:chapter|ch\.?|topic|part|pt\.?|lesson|lecture|unit|session|section|episode|track|audio)\s*[#:.\-–]?\s*(\d+)/i;

function sequenceKey(title: string): { index: number; tie: string } {
  const t = title.trim();
  const labeled = t.match(LABELED_INDEX);
  if (labeled) return { index: parseInt(labeled[1], 10), tie: t.toLowerCase() };
  const anyNum = t.match(/(\d+)/);
  if (anyNum) return { index: parseInt(anyNum[1], 10), tie: t.toLowerCase() };
  return { index: Number.MAX_SAFE_INTEGER, tie: t.toLowerCase() };
}

export function sortAudiosBySequence<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = sequenceKey(a.title);
    const kb = sequenceKey(b.title);
    if (ka.index !== kb.index) return ka.index - kb.index;
    return ka.tie.localeCompare(kb.tie, undefined, { numeric: true, sensitivity: "base" });
  });
}

/** Filter by subject and apply `sortAudiosBySequence` (used for /subjects/[id] and /audios/[id]). */
export function audiosForSubjectSorted<T extends { subjectId: string; title: string }>(
  audios: T[],
  subjectId: string,
): T[] {
  const list = audios.filter((a) => a.subjectId === subjectId);
  return sortAudiosBySequence(list);
}
