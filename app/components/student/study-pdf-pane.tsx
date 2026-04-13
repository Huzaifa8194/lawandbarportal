"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

const PDF_ZOOM_MIN = 0.65;
const PDF_ZOOM_MAX = 3;
const PDF_ZOOM_STEP = 1.12;
/** Horizontal swipe (px) to turn a page on mobile when zoom ≈ 1 */
const PDF_SWIPE_PAGE_PX = 56;

function clampPdfZoom(z: number) {
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, z));
}

function safePdfDownloadBasename(title: string) {
  const t = title
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return t || "book";
}

function touchDistance(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

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
  mobileToolbarAddon?: ReactNode;
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
  mobileToolbarAddon,
}: StudyPdfPaneProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [selectedColor, setSelectedColor] = useState<PdfHighlight["color"]>("yellow");
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; text: string }>({
    open: false,
    text: "",
  });
  const [noteContent, setNoteContent] = useState("");
  const [pageWidth, setPageWidth] = useState(320);
  const [pdfZoom, setPdfZoom] = useState(1);
  /** Unscaled render size from react-pdf (CSS zoom applied separately for performance). */
  const [pageRenderSize, setPageRenderSize] = useState<{ w: number; h: number } | null>(null);
  const [mobilePdfChrome, setMobilePdfChrome] = useState(false);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pdfZoomRef = useRef(1);
  const pageNavRef = useRef({
    currentPage,
    totalPages: totalPages ?? null,
    onPageChange,
  });

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

  useEffect(() => {
    pdfZoomRef.current = pdfZoom;
  }, [pdfZoom]);

  useEffect(() => {
    setPdfZoom(1);
  }, [bookId]);

  useEffect(() => {
    pageNavRef.current = { currentPage, totalPages: totalPages ?? null, onPageChange };
  }, [currentPage, totalPages, onPageChange]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px), (pointer: coarse)");
    const apply = () => setMobilePdfChrome(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Pinch-zoom + mobile swipe page-turn (needs non-passive touchmove)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let pinchStart: { dist: number; zoom: number } | null = null;
    let swipeStart: { x: number; y: number } | null = null;
    let gestureHadTwoFingers = false;
    let rafId = 0;
    let pendingZoom: number | null = null;

    const flushZoom = () => {
      if (pendingZoom != null) {
        setPdfZoom(clampPdfZoom(pendingZoom));
        pendingZoom = null;
      }
      rafId = 0;
    };

    const scheduleZoom = (z: number) => {
      pendingZoom = z;
      if (!rafId) rafId = requestAnimationFrame(flushZoom);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        gestureHadTwoFingers = true;
        pinchStart = { dist: touchDistance(e.touches), zoom: pdfZoomRef.current };
        swipeStart = null;
      } else if (e.touches.length === 1 && !gestureHadTwoFingers) {
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault();
        const d = touchDistance(e.touches);
        if (pinchStart.dist < 8) return;
        const next = clampPdfZoom(pinchStart.zoom * (d / pinchStart.dist));
        scheduleZoom(next);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 2) return;

      if (e.touches.length === 1) {
        flushZoom();
        pinchStart = null;
        return;
      }

      flushZoom();

      const { currentPage: cp, totalPages: tp, onPageChange: nav } = pageNavRef.current;
      const canPrev = cp > 1;
      const canNext = tp == null || cp < tp;

      if (
        !gestureHadTwoFingers &&
        swipeStart &&
        mobilePdfChrome &&
        nav &&
        pdfZoomRef.current <= 1.02
      ) {
        const t = e.changedTouches[0];
        const dx = t.clientX - swipeStart.x;
        const dy = t.clientY - swipeStart.y;
        const sel = window.getSelection();
        if (!sel?.toString().trim()) {
          if (
            Math.abs(dx) > PDF_SWIPE_PAGE_PX &&
            Math.abs(dx) > Math.abs(dy) * 1.25
          ) {
            if (dx < 0 && canNext) {
              nav(Math.min(cp + 1, tp ?? cp + 1));
            } else if (dx > 0 && canPrev) {
              nav(cp - 1);
            }
          }
        }
      }

      gestureHadTwoFingers = false;
      pinchStart = null;
      swipeStart = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [mobilePdfChrome]);

  // Desktop / trackpad: Ctrl/Cmd + wheel to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? PDF_ZOOM_STEP : 1 / PDF_ZOOM_STEP;
      setPdfZoom((z) => clampPdfZoom(z * factor));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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

  const handlePrintPdf = useCallback(() => {
    const w = window.open(pdfBlobUrl);
    if (!w) return;
    const runPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    };
    w.addEventListener("load", runPrint, { once: true });
    setTimeout(runPrint, 500);
  }, [pdfBlobUrl]);

  const rectHighlights = pageHighlights?.filter((h) => h.rects?.length) ?? [];

  const basePageWidth = Math.min(pageWidth - 24, 680);

  useEffect(() => {
    setPageRenderSize(null);
  }, [bookId, currentPage, basePageWidth]);

  const handlePdfPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageRenderSize({ w: page.width, h: page.height });
  }, []);

  const pageLayoutHeight = pageRenderSize?.h ?? basePageWidth * 1.35;
  const zoomNearOne = pdfZoom <= 1.02;
  /** When zoomed, let the browser handle pan with full momentum (no custom pan-y lock). */
  const pdfTouchAction = mobilePdfChrome && zoomNearOne ? "pan-y" : "auto";

  const scaledViewportW = basePageWidth * pdfZoom;
  const scaledViewportH = pageLayoutHeight * pdfZoom;
  const pdfViewportStyle =
    pageRenderSize != null
      ? { width: scaledViewportW, height: scaledViewportH, flexShrink: 0 as const }
      : { width: scaledViewportW, minHeight: scaledViewportH, flexShrink: 0 as const };

  /** When wider than the scroll area, left-align so scrollLeft=0 is the PDF left edge (symmetric pan). */
  const pdfScrollAlignLeft = scaledViewportW > pageWidth - 8;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1110]">
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-white/10 bg-[#0d1514]/95 px-2 py-1.5 backdrop-blur">
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
        {mobileToolbarAddon ? <div className="lg:hidden">{mobileToolbarAddon}</div> : null}

        {/* Zoom: buttons + Ctrl/Cmd+wheel (see title) */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={pdfZoom <= PDF_ZOOM_MIN + 0.01}
            onClick={() => setPdfZoom((z) => clampPdfZoom(z / PDF_ZOOM_STEP))}
            className="flex size-7 items-center justify-center rounded text-white/65 transition enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-25"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span
            className="min-w-[2.75rem] select-none text-center text-[10px] tabular-nums text-white/45"
            title="Pinch on touchscreens. Ctrl+scroll (Windows) or ⌘+scroll (Mac)."
          >
            {Math.round(pdfZoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={pdfZoom >= PDF_ZOOM_MAX - 0.01}
            onClick={() => setPdfZoom((z) => clampPdfZoom(z * PDF_ZOOM_STEP))}
            className="flex size-7 items-center justify-center rounded text-white/65 transition enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-25"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Open, download, print (icons — stays in PDF toolbar, not site navbar) */}
        <a
          href={pdfBlobUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${title} in a new tab`}
          className="flex size-7 items-center justify-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white/60"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          href={pdfBlobUrl}
          download={`${safePdfDownloadBasename(title)}.pdf`}
          title={`Download ${title}`}
          className="flex size-7 items-center justify-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white/60"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
        </a>
        <button
          type="button"
          onClick={handlePrintPdf}
          title="Print PDF"
          aria-label="Print PDF"
          className="flex size-7 items-center justify-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white/60"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
        </button>

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
          <span className="text-[10px] text-white/25 sm:hidden">
            Pinch to zoom · Swipe left/right to turn pages
          </span>
          <span className="hidden text-[10px] text-white/25 sm:inline">\u2190 \u2192 keys to flip pages · Ctrl/⌘ + scroll to zoom</span>
        </div>
      )}

      {/* ── PDF area ── */}
      <div
        ref={containerRef}
        className="pdf-zoom-container relative min-h-0 flex-1 overflow-auto bg-[#0b1110]"
        style={{ touchAction: pdfTouchAction }}
        title="Pinch or Ctrl/⌘ + scroll to zoom. On phone, swipe horizontally to change pages when not zoomed in."
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
                  ? "cursor-pointer bg-gradient-to-r from-white/20 via-white/8 to-transparent text-white/90 hover:from-white/30 hover:text-white"
                  : "pointer-events-none text-transparent"
              }`}
            >
              <span className="rounded-full border border-white/35 bg-white/20 p-2 backdrop-blur">
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
                  ? "cursor-pointer bg-gradient-to-l from-white/20 via-white/8 to-transparent text-white/90 hover:from-white/30 hover:text-white"
                  : "pointer-events-none text-transparent"
              }`}
            >
              <span className="rounded-full border border-white/35 bg-white/20 p-2 backdrop-blur">
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
            className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/25 p-2 text-white shadow-lg backdrop-blur md:hidden"
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
            className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/25 p-2 text-white shadow-lg backdrop-blur md:hidden"
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
          className="block w-full min-w-0"
        >
          {/*
            Viewport sized to scaled dimensions so overflow:auto uses native smooth scrolling.
            Page renders once at base width; zoom is CSS transform only (no pdf.js re-raster per zoom).
            When zoomed past the pane width, avoid flex items-center — it pins the block in a way that
            blocks panning to the true left edge; use text-center only when the page fits.
          */}
          <div
            className={`min-w-full px-3 py-3 ${pdfScrollAlignLeft ? "text-left" : "text-center"}`}
          >
            <div className="relative inline-block shrink-0 align-top" style={pdfViewportStyle}>
            <div
              ref={pageRef}
              onMouseUp={handleSelectionEnd}
              onTouchEnd={handleSelectionEnd}
              className="absolute left-0 top-0 shadow-xl shadow-black/30"
              style={{
                width: basePageWidth,
                lineHeight: 0,
                cursor: activeTool ? "text" : "default",
                transform: `scale(${pdfZoom})`,
                transformOrigin: "top left",
                willChange: "transform",
              }}
            >
              <Page
                pageNumber={currentPage}
                width={basePageWidth}
                onLoadSuccess={handlePdfPageLoadSuccess}
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
            </div>
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
