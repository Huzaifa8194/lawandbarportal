"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { HighlightRect, PdfHighlight } from "@/lib/types/student";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ── Constants ────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS: PdfHighlight["color"][] = ["yellow", "green", "blue", "pink"];

const COLOR_HEX: Record<PdfHighlight["color"], string> = {
  yellow: "#fef08a",
  green: "#86efac",
  blue: "#93c5fd",
  pink: "#f9a8d4",
};

const OVERLAY_BG: Record<PdfHighlight["color"], string> = {
  yellow: "rgba(254, 240, 138, 0.38)",
  green: "rgba(134, 239, 172, 0.38)",
  blue: "rgba(147, 197, 253, 0.38)",
  pink: "rgba(249, 168, 212, 0.38)",
};

type ActiveTool = "highlight" | "note" | null;

// ── Hooks ────────────────────────────────────────────────────────────────────

export function usePreferPdfJsViewer() {
  const [prefer, setPrefer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px), (pointer: coarse)");
    const update = () => setPrefer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return prefer;
}

// ── Text-matching highlights (backward compat for highlights without rects) ──

function applyHighlightMarks(
  container: HTMLElement,
  highlights: PdfHighlight[],
): () => void {
  const textLayer = container.querySelector(
    ".react-pdf__Page__textContent",
  ) as HTMLElement | null;
  if (!textLayer || !highlights.length) return () => {};

  const spans = Array.from(
    textLayer.querySelectorAll("span"),
  ) as HTMLSpanElement[];
  if (!spans.length) return () => {};

  const charToSpan: HTMLSpanElement[] = [];
  let fullText = "";
  for (const span of spans) {
    const t = span.textContent || "";
    for (let i = 0; i < t.length; i++) charToSpan.push(span);
    fullText += t;
  }

  const noWsToOrig: number[] = [];
  let stripped = "";
  for (let i = 0; i < fullText.length; i++) {
    if (!/\s/.test(fullText[i])) {
      noWsToOrig.push(i);
      stripped += fullText[i];
    }
  }
  const strippedLower = stripped.toLowerCase();

  const modified = new Map<HTMLSpanElement, string>();

  for (const hl of highlights) {
    const needle = hl.text.replace(/\s/g, "").toLowerCase();
    if (needle.length < 2) continue;

    let from = 0;
    while (from < strippedLower.length) {
      const idx = strippedLower.indexOf(needle, from);
      if (idx === -1) break;

      const origStart = noWsToOrig[idx];
      const origEnd = noWsToOrig[idx + needle.length - 1];

      const touched = new Set<HTMLSpanElement>();
      for (let i = origStart; i <= origEnd; i++) {
        if (charToSpan[i]) touched.add(charToSpan[i]);
      }

      for (const span of touched) {
        if (!modified.has(span)) modified.set(span, span.style.cssText);
        span.style.backgroundColor =
          OVERLAY_BG[hl.color] || OVERLAY_BG.yellow;
        span.style.borderRadius = "2px";
      }

      from = idx + needle.length;
    }
  }

  return () => {
    for (const [span, orig] of modified) span.style.cssText = orig;
  };
}

// ── Rect capture helper ──────────────────────────────────────────────────────

function captureSelectionRects(
  pageEl: HTMLElement | null,
): HighlightRect[] | undefined {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !pageEl) return undefined;
  const range = sel.getRangeAt(0);
  const cb = pageEl.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: ((r.left - cb.left) / cb.width) * 100,
      top: ((r.top - cb.top) / cb.height) * 100,
      width: (r.width / cb.width) * 100,
      height: (r.height / cb.height) * 100,
    }));
  return rects.length ? rects : undefined;
}

// ── SelectionToolbar (passive mode — shown when no tool is active) ───────────

function SelectionToolbar({
  containerRef,
  pageRef,
  onHighlight,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  pageRef: React.RefObject<HTMLElement | null>;
  onHighlight: (text: string, color: PdfHighlight["color"], rects?: HighlightRect[]) => void;
}) {
  const [pos, setPos] = useState<{
    x: number;
    y: number;
    h: number;
    text: string;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const raw = sel.toString();
    const text = raw.trim().replace(/\s+/g, " ");
    if (text.length < 2 || !containerRef.current) return;

    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
      h: rect.height,
      text,
    });
    setSaved(false);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleUp = () => setTimeout(checkSelection, 16);
    container.addEventListener("mouseup", handleUp);
    container.addEventListener("touchend", handleUp);

    return () => {
      container.removeEventListener("mouseup", handleUp);
      container.removeEventListener("touchend", handleUp);
    };
  }, [containerRef, checkSelection]);

  useEffect(() => {
    if (!pos) return;

    const dismiss = (e: MouseEvent | TouchEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setPos(null);
        }
      }, 150);
    };

    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("touchstart", dismiss);
    };
  }, [pos]);

  if (!pos) return null;

  const handleHighlight = (color: PdfHighlight["color"]) => {
    const rects = captureSelectionRects(pageRef.current);
    onHighlight(pos.text, color, rects);
    setSaved(true);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => setPos(null), 700);
  };

  const isTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  const toolbarY = isTouch
    ? Math.min(
        (typeof window !== "undefined" ? window.innerHeight : 800) - 60,
        pos.y + pos.h + 12,
      )
    : Math.max(8, pos.y - 48);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Highlight selected text"
      className="fixed z-[9999] flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#1a2b29]/95 px-2.5 py-2 shadow-2xl shadow-black/40 backdrop-blur-md"
      style={{
        left: `clamp(90px, ${pos.x}px, calc(100vw - 90px))`,
        top: `${toolbarY}px`,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {saved ? (
        <span className="flex items-center gap-1.5 px-1 text-xs font-semibold text-[#6cf4e0]">
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Highlighted!
        </span>
      ) : (
        <>
          <span className="mr-0.5 select-none text-[11px] font-medium text-white/55">
            Highlight
          </span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleHighlight(c)}
              aria-label={`Highlight ${c}`}
              className="size-7 rounded-full border-2 border-transparent transition-all hover:scale-110 hover:border-white/60 active:scale-90 sm:size-6"
              style={{ backgroundColor: COLOR_HEX[c] }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            aria-label="Dismiss"
            className="ml-0.5 flex size-5 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70"
          >
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type StudyPdfPaneProps = {
  bookId: string;
  pdfBlobUrl: string;
  iframePdfUrl?: string;
  title: string;
  currentPage: number;
  totalPages?: number | null;
  onPageChange?: (page: number) => void;
  onNumPages: (n: number) => void;
  onHighlight?: (text: string, color: PdfHighlight["color"], rects?: HighlightRect[]) => void;
  onNote?: (selectedText: string, noteContent: string) => void;
  pageHighlights?: PdfHighlight[];
};

export default function StudyPdfPane({
  bookId,
  pdfBlobUrl,
  title,
  currentPage,
  totalPages,
  onPageChange,
  onNumPages,
  onHighlight,
  onNote,
  pageHighlights,
}: StudyPdfPaneProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [selectedColor, setSelectedColor] = useState<PdfHighlight["color"]>("yellow");
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; text: string }>({
    open: false,
    text: "",
  });
  const [noteContent, setNoteContent] = useState("");
  const [pageWidth, setPageWidth] = useState(320);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(Math.max(240, Math.floor(w)));
    });
    ro.observe(el);
    setPageWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);

  // Keyboard navigation: ArrowLeft/ArrowRight to change pages
  useEffect(() => {
    if (!onPageChange) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft" && currentPage > 1) {
        e.preventDefault();
        onPageChange(currentPage - 1);
      } else if (e.key === "ArrowRight" && (!totalPages || currentPage < totalPages)) {
        e.preventDefault();
        onPageChange(Math.min(currentPage + 1, totalPages || currentPage + 1));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onPageChange, currentPage, totalPages]);

  // Paint text-matching highlights for backward compat (highlights without rects)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pageHighlights?.length) return;
    const textMatchHighlights = pageHighlights.filter((h) => !h.rects?.length);
    if (!textMatchHighlights.length) return;

    let cleanup: (() => void) | null = null;
    let debounce: ReturnType<typeof setTimeout>;

    const apply = () => {
      cleanup?.();
      cleanup = applyHighlightMarks(container, textMatchHighlights);
    };

    const debouncedApply = () => {
      clearTimeout(debounce);
      debounce = setTimeout(apply, 60);
    };

    const observer = new MutationObserver(debouncedApply);
    observer.observe(container, { childList: true, subtree: true });
    const initial = setTimeout(apply, 120);

    return () => {
      clearTimeout(initial);
      clearTimeout(debounce);
      observer.disconnect();
      cleanup?.();
    };
  }, [pageHighlights]);

  const handleSelectionEnd = useCallback(() => {
    if (!activeTool) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().trim().replace(/\s+/g, " ");
    if (text.length < 2) return;
    const rects = captureSelectionRects(pageRef.current);
    sel.removeAllRanges();

    if (activeTool === "highlight") {
      onHighlight?.(text, selectedColor, rects);
    } else if (activeTool === "note") {
      setNoteDialog({ open: true, text });
      setNoteContent("");
    }
  }, [activeTool, selectedColor, onHighlight]);

  const handleNoteSave = () => {
    if (!noteContent.trim()) return;
    onNote?.(noteDialog.text, noteContent.trim());
    setNoteDialog({ open: false, text: "" });
    setNoteContent("");
  };

  const canGoPrev = currentPage > 1;
  const canGoNext = totalPages ? currentPage < totalPages : true;
  const goPage = (page: number) =>
    onPageChange?.(Math.max(1, totalPages ? Math.min(page, totalPages) : page));

  const commitPageInput = () => {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && (!totalPages || num <= totalPages)) {
      goPage(num);
    }
    setEditingPage(false);
  };

  const rectHighlights = pageHighlights?.filter((h) => h.rects?.length) ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1110]">
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-[#0d1514]/95 px-2 py-1.5 backdrop-blur">
        {/* Highlight tool */}
        <button
          type="button"
          onClick={() => setActiveTool((prev) => (prev === "highlight" ? null : "highlight"))}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
            activeTool === "highlight"
              ? "border border-[#26d9c0]/50 bg-[#26d9c0]/20 text-[#6cf4e0]"
              : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill={activeTool === "highlight" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          <span className="hidden sm:inline">Highlight</span>
        </button>

        {/* Note tool */}
        {onNote && (
          <button
            type="button"
            onClick={() => setActiveTool((prev) => (prev === "note" ? null : "note"))}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              activeTool === "note"
                ? "border border-blue-400/50 bg-blue-500/20 text-blue-300"
                : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <span className="hidden sm:inline">Note</span>
          </button>
        )}

        {/* Color swatches (visible when a tool is active) */}
        {activeTool && (
          <>
            <div className="mx-1 h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  aria-label={`${c} color`}
                  className={`size-5 rounded-full border-2 transition sm:size-[22px] ${
                    selectedColor === c
                      ? "scale-110 border-white"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: COLOR_HEX[c] }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              aria-label="Close tool"
              className="ml-1 flex size-5 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
            >
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Open externally (icon only) */}
        <a
          href={pdfBlobUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${title} externally`}
          className="flex size-7 items-center justify-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white/60"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        {/* Page navigation */}
        {onPageChange && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => canGoPrev && goPage(currentPage - 1)}
              disabled={!canGoPrev}
              aria-label="Previous page"
              className="flex size-7 items-center justify-center rounded-md border border-white/10 text-white/60 transition enabled:hover:bg-white/10 disabled:opacity-30"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Go-to-page: click to edit, Enter to confirm */}
            {editingPage ? (
              <input
                ref={pageInputRef}
                type="number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitPageInput();
                  if (e.key === "Escape") setEditingPage(false);
                }}
                onBlur={commitPageInput}
                min={1}
                max={totalPages || undefined}
                className="h-7 w-14 rounded-md border border-[#26d9c0]/40 bg-[#0a1110] px-1.5 text-center text-xs tabular-nums text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPageInput(String(currentPage));
                  setEditingPage(true);
                  setTimeout(() => pageInputRef.current?.select(), 0);
                }}
                title="Click to jump to a page"
                className="flex h-7 min-w-[3.5rem] items-center justify-center rounded-md border border-white/10 px-1.5 text-[11px] tabular-nums text-white/50 transition hover:border-white/25 hover:text-white/70"
              >
                {currentPage}
                <span className="text-white/30">/{totalPages || "\u2014"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => canGoNext && goPage(currentPage + 1)}
              disabled={!canGoNext}
              aria-label="Next page"
              className="flex size-7 items-center justify-center rounded-md border border-white/10 text-white/60 transition enabled:hover:bg-white/10 disabled:opacity-30"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Hint bar (when tool active) ── */}
      {activeTool && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#26d9c0]/20 bg-[#26d9c0]/[0.08] px-3 py-1">
          <span className="size-1.5 shrink-0 rounded-full bg-[#26d9c0]" />
          <span className="text-[11px] text-[#a8d5c2]">
            {activeTool === "highlight"
              ? "Select text to highlight."
              : "Select text to add a note."}
          </span>
          <span className="hidden text-[10px] text-white/25 sm:inline">\u2190 \u2192 keys to flip pages</span>
        </div>
      )}

      {/* ── PDF area ── */}
      <div
        ref={containerRef}
        className="pdf-zoom-container relative min-h-0 flex-1 overflow-auto bg-[#0b1110]"
      >
        {/* Desktop: full-height professional book-edge navigators */}
        {onPageChange && (
          <>
            <button
              type="button"
              onClick={() => canGoPrev && goPage(currentPage - 1)}
              disabled={!canGoPrev}
              aria-label="Previous page"
              className={`absolute bottom-0 left-0 top-0 z-10 hidden w-20 items-center justify-start pl-2 transition md:flex ${
                canGoPrev
                  ? "cursor-pointer bg-gradient-to-r from-black/35 via-black/10 to-transparent text-white/70 hover:from-black/45 hover:text-white"
                  : "pointer-events-none text-transparent"
              }`}
            >
              <span className="rounded-full border border-white/20 bg-black/30 p-2 backdrop-blur">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={() => canGoNext && goPage(currentPage + 1)}
              disabled={!canGoNext}
              aria-label="Next page"
              className={`absolute bottom-0 right-0 top-0 z-10 hidden w-20 items-center justify-end pr-2 transition md:flex ${
                canGoNext
                  ? "cursor-pointer bg-gradient-to-l from-black/35 via-black/10 to-transparent text-white/70 hover:from-black/45 hover:text-white"
                  : "pointer-events-none text-transparent"
              }`}
            >
              <span className="rounded-full border border-white/20 bg-black/30 p-2 backdrop-blur">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </>
        )}

        {/* Mobile: visible carousel-style navigation buttons */}
        {onPageChange && canGoPrev && (
          <button
            type="button"
            onClick={() => goPage(currentPage - 1)}
            aria-label="Previous page"
            className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 p-2 text-white/85 shadow-lg backdrop-blur md:hidden"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {onPageChange && canGoNext && (
          <button
            type="button"
            onClick={() => goPage(currentPage + 1)}
            aria-label="Next page"
            className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 p-2 text-white/85 shadow-lg backdrop-blur md:hidden"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <Document
          key={bookId}
          file={pdfBlobUrl}
          loading={
            <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-white/60">
              Rendering PDF&hellip;
            </div>
          }
          error={
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-300">
              <p>Could not display the PDF in the app viewer.</p>
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#26d9c0] underline decoration-dotted underline-offset-2"
              >
                Open PDF externally
              </a>
            </div>
          }
          onLoadSuccess={({ numPages }) => onNumPages(numPages)}
          className="flex flex-col items-center gap-3 py-3"
        >
          <div
            ref={pageRef}
            onMouseUp={handleSelectionEnd}
            onTouchEnd={handleSelectionEnd}
            className="relative shadow-xl shadow-black/30"
            style={{
              lineHeight: 0,
              cursor: activeTool ? "text" : "default",
            }}
          >
            <Page
              pageNumber={currentPage}
              width={Math.min(pageWidth - 24, 680)}
              renderTextLayer
              renderAnnotationLayer
            />
            {/* Rect-based highlight overlays */}
            {rectHighlights.map((hl) =>
              hl.rects!.map((r, i) => (
                <div
                  key={`hl-${hl.id}-${i}`}
                  style={{
                    position: "absolute",
                    left: `${r.left}%`,
                    top: `${r.top}%`,
                    width: `${r.width}%`,
                    height: `${r.height}%`,
                    backgroundColor: OVERLAY_BG[hl.color] || OVERLAY_BG.yellow,
                    pointerEvents: "none",
                    borderRadius: 2,
                    mixBlendMode: "multiply",
                  }}
                />
              )),
            )}
          </div>
        </Document>

        {/* Passive floating toolbar (when no tool is active) */}
        {!activeTool && onHighlight && (
          <SelectionToolbar
            key={currentPage}
            containerRef={containerRef}
            pageRef={pageRef}
            onHighlight={onHighlight}
          />
        )}
      </div>

      {/* ── Note input panel ── */}
      {noteDialog.open && (
        <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#0d1514] p-3">
          <div className="text-xs text-white/50">
            <span className="font-medium text-white/70">Selected: </span>
            &ldquo;
            {noteDialog.text.length > 120
              ? noteDialog.text.slice(0, 120) + "\u2026"
              : noteDialog.text}
            &rdquo;
          </div>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Type your note about this text&hellip;"
            rows={3}
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-[#0a1110] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#26d9c0]/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNoteSave}
              className="min-h-[36px] flex-1 rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-1.5 text-sm font-medium text-[#78ffea] active:bg-[#26d9c0]/25"
            >
              Save note
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteDialog({ open: false, text: "" });
                setNoteContent("");
                setActiveTool(null);
              }}
              className="min-h-[36px] rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/85"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
