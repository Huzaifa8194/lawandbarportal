import type { AnnotationTransferItem, PdfHighlightAnnoObject } from "@embedpdf/react-pdf-viewer";
import type { PdfHighlight, PdfNote } from "@/lib/types/student";

// PDF enum value from the engine's stable PDF annotation subtype specification.
const HIGHLIGHT = 9;
const COLORS = { yellow: "#fef08a", green: "#86efac", blue: "#93c5fd", pink: "#f9a8d4" };

export function viewerStudyItems(json: string): { highlights: PdfHighlight[]; notes: PdfNote[] } {
  const highlights: PdfHighlight[] = [], notes: PdfNote[] = [];
  try {
    const items = JSON.parse(json || "[]") as AnnotationTransferItem[];
    for (const {annotation} of items) {
      if (annotation.id.startsWith("portal-legacy-")) continue;
      const base = {id: `viewer:${annotation.id}`, page: annotation.pageIndex + 1, createdAt: String(annotation.created || "")};
      if (annotation.type === HIGHLIGHT) {
        const hex = annotation.strokeColor || annotation.color || COLORS.yellow;
        const color = (Object.keys(COLORS) as Array<keyof typeof COLORS>).find((key) => COLORS[key] === hex) || "yellow";
        highlights.push({...base, color, text: annotation.contents || "Highlighted passage — select it in the PDF to add a comment."});
      } else if ((annotation.type === 1 || annotation.type === 3) && annotation.contents) {
        notes.push({...base, text: annotation.contents});
      }
    }
  } catch { /* The viewer reports malformed saved annotations without overwriting them. */ }
  return {highlights, notes};
}

export function restoreViewerAnnotations(json: string, highlights: PdfHighlight[], pages: Array<{size: {width: number; height: number}}>): AnnotationTransferItem[] {
  const saved = json ? JSON.parse(json) as AnnotationTransferItem[] : [];
  if (!Array.isArray(saved)) throw new Error("Saved PDF annotations are not a list.");
  const legacyIds = new Set(highlights.map((h) => `portal-legacy-${h.id}`));
  const items = saved.filter((item) => item.annotation && (!item.annotation.id.startsWith("portal-legacy-") || legacyIds.has(item.annotation.id)));
  for (const item of items) {
    if (item.annotation.created) item.annotation.created = new Date(item.annotation.created);
    if (item.annotation.modified) item.annotation.modified = new Date(item.annotation.modified);
  }
  const ids = new Set(items.map((item) => item.annotation.id));
  for (const highlight of highlights) {
    const id = `portal-legacy-${highlight.id}`;
    const page = pages[highlight.page - 1];
    if (ids.has(id) || !page || !highlight.rects?.length) continue;
    const segmentRects = highlight.rects.map((r) => ({ origin: {x: r.left / 100 * page.size.width, y: r.top / 100 * page.size.height}, size: {width: r.width / 100 * page.size.width, height: r.height / 100 * page.size.height} }));
    const left = Math.min(...segmentRects.map((r) => r.origin.x));
    const top = Math.min(...segmentRects.map((r) => r.origin.y));
    const right = Math.max(...segmentRects.map((r) => r.origin.x + r.size.width));
    const bottom = Math.max(...segmentRects.map((r) => r.origin.y + r.size.height));
    const annotation: PdfHighlightAnnoObject = { id, type: HIGHLIGHT, pageIndex: highlight.page - 1, contents: highlight.text, opacity: 0.4, strokeColor: COLORS[highlight.color], rect: {origin: {x: left, y: top}, size: {width: right - left, height: bottom - top}}, segmentRects };
    items.push({ annotation });
  }
  return items;
}
