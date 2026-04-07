"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfHighlight } from "@/lib/types/student";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

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

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

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

/**
 * Searches the react-pdf text layer for each highlight's text (whitespace-
 * insensitive, case-insensitive) and applies a coloured background to the
 * matching <span> elements.  Returns a cleanup function that restores the
 * original inline styles.
 */
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

  // Map every character in the concatenated text back to its parent span
  const charToSpan: HTMLSpanElement[] = [];
  let fullText = "";
  for (const span of spans) {
    const t = span.textContent || "";
    for (let i = 0; i < t.length; i++) charToSpan.push(span);
    fullText += t;
  }

  // Build a whitespace-stripped version + position map so we can match
  // regardless of how PDF.js splits words across spans
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

/* ------------------------------------------------------------------ */
/*  SelectionToolbar – floating colour-picker that appears on select  */
/* ------------------------------------------------------------------ */

function SelectionToolbar({
  containerRef,
  onHighlight,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  onHighlight: (text: string, color: PdfHighlight["color"]) => void;
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
    onHighlight(pos.text, color);
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
          <svg
            className="size-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
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
            <svg
              className="size-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudyPdfPane                                                       */
/* ------------------------------------------------------------------ */

type StudyPdfPaneProps = {
  bookId: string;
  pdfBlobUrl: string;
  iframePdfUrl: string;
  title: string;
  currentPage: number;
  onNumPages: (n: number) => void;
  onHighlight?: (text: string, color: PdfHighlight["color"]) => void;
  pageHighlights?: PdfHighlight[];
};

export default function StudyPdfPane({
  bookId,
  pdfBlobUrl,
  iframePdfUrl,
  title,
  currentPage,
  onNumPages,
  onHighlight,
  pageHighlights,
}: StudyPdfPaneProps) {
  const preferPdfJs = usePreferPdfJsViewer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(320);
  const [highlightMode, setHighlightMode] = useState(false);

  const usePdfJs = preferPdfJs || highlightMode;

  useEffect(() => {
    if (!usePdfJs || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(Math.max(240, Math.floor(w)));
    });
    ro.observe(el);
    setPageWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, [usePdfJs]);

  // Paint saved highlights onto the text layer after react-pdf renders it
  useEffect(() => {
    if (!usePdfJs || !pageHighlights?.length) return;
    const container = containerRef.current;
    if (!container) return;

    let cleanup: (() => void) | null = null;
    let debounce: ReturnType<typeof setTimeout>;

    const apply = () => {
      cleanup?.();
      cleanup = applyHighlightMarks(container, pageHighlights);
    };

    const debouncedApply = () => {
      clearTimeout(debounce);
      debounce = setTimeout(apply, 60);
    };

    // Re-apply whenever react-pdf swaps the text layer DOM (page change, etc.)
    const observer = new MutationObserver(debouncedApply);
    observer.observe(container, { childList: true, subtree: true });

    // First paint – wait a tick for the text layer to finish
    const initial = setTimeout(apply, 120);

    return () => {
      clearTimeout(initial);
      clearTimeout(debounce);
      observer.disconnect();
      cleanup?.();
    };
  }, [usePdfJs, pageHighlights]);

  const openExternal = (
    <a
      href={pdfBlobUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-block text-center text-xs font-medium text-[#26d9c0] underline decoration-dotted underline-offset-2"
    >
      Open PDF in browser / download
    </a>
  );

  const highlightToggle =
    !preferPdfJs && onHighlight ? (
      <button
        type="button"
        onClick={() => setHighlightMode((prev) => !prev)}
        title={
          highlightMode
            ? "Return to native PDF viewer"
            : "Switch to interactive viewer to highlight text"
        }
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
          highlightMode
            ? "border-[#26d9c0]/60 bg-[#26d9c0]/20 text-[#6cf4e0] shadow-sm shadow-[#26d9c0]/10"
            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
        }`}
      >
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill={highlightMode ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        {highlightMode ? "Done highlighting" : "Highlight text"}
      </button>
    ) : null;

  if (usePdfJs) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        {highlightToggle && (
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            {highlightToggle}
            {highlightMode && (
              <span className="text-[11px] text-[#6cf4e0]/60 sm:text-xs">
                Select text → pick a color
              </span>
            )}
          </div>
        )}
        <div
          ref={containerRef}
          className="pdf-zoom-container relative min-h-0 flex-1 overflow-auto bg-[#0b1110]"
        >
          <Document
            key={bookId}
            file={pdfBlobUrl}
            loading={
              <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-white/60">
                Rendering PDF…
              </div>
            }
            error={
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-300">
                <p>Could not display the PDF in the app viewer.</p>
                {openExternal}
              </div>
            }
            onLoadSuccess={({ numPages }) => onNumPages(numPages)}
            className="flex flex-col items-center gap-3 py-3"
          >
            <Page
              pageNumber={currentPage}
              width={Math.min(pageWidth, 900)}
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
          {onHighlight && (
            <SelectionToolbar
              key={currentPage}
              containerRef={containerRef}
              onHighlight={onHighlight}
            />
          )}
        </div>
        <div className="shrink-0 px-1 pt-2 text-center">{openExternal}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      {highlightToggle && (
        <div className="mb-2 flex shrink-0 items-center justify-end">
          {highlightToggle}
        </div>
      )}
      <iframe
        key={bookId}
        src={iframePdfUrl}
        title={title}
        className="block flex-1 min-h-[480px] w-full border-0 bg-[#0b1110]"
      />
    </div>
  );
}
