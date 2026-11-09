"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PDFViewer, version as embedPdfVersion, AnnotationPlugin, DocumentManagerPlugin, ScrollPlugin, SelectionPlugin, ScrollStrategy, SpreadMode, UIPlugin, ViewportPlugin, ZoomPlugin, ZoomMode, type PluginRegistry, type PDFViewerConfig, type AnnotationCapability, type ScrollCapability } from "@embedpdf/react-pdf-viewer";
import { PdfLoadError } from "@/lib/pdf-errors";
import { restoreViewerAnnotations } from "@/lib/pdf-annotations";
import type { PdfHighlight } from "@/lib/types/student";
import PdfFeedback from "./pdf-feedback";

// EmbedPDF's horizontal scroller measures pages from their left edge. Move
// only the painted page, keeping its measured position for paging and search.
const readerViewport = '.embedpdf-snippet-root .bg-bg-app[style*="overflow: auto"]';
const readerStrip = `${readerViewport} div[style*="margin:"][style*="flex-direction: row"]`;
const readerPages = `${readerStrip} > div:nth-child(2) > div`;
const readerLayout = `
  .embedpdf-snippet-root [data-epdf-i="main-toolbar"],
  .embedpdf-snippet-root .bg-bg-surface-alt.border-b { padding-block: 2px; }
  ${readerViewport} { container-type: inline-size; overflow-x: hidden !important; overscroll-behavior: contain; }
  ${readerViewport} > div:has(> div[style*="flex-direction: row"]) { margin-inline: 0 !important; }
  ${readerStrip} { margin: 0 !important; }
  ${readerStrip}::after { content: ""; position: absolute; left: 100%; top: 0; width: 100cqw; height: 1px; pointer-events: none; }
  ${readerPages} > div { translate: max(0px, calc(50cqw - 50%)) 0; box-shadow: 0 4px 18px #080d0b55; }
`;

export type StudyPdfPaneProps = {
  bookId: string;
  pdfBlobUrl: string;
  title: string;
  currentPage: number;
  totalPages?: number | null;
  onPageChange?: (page: number) => void;
  onNumPages: (n: number) => void;
  onNote?: (selectedText: string, content: string, page: number) => void;
  highlights: PdfHighlight[];
  annotationsJson: string;
  onAnnotationsChange: (json: string) => void;
  onLegacyHighlightDelete: (id: string) => void;
  mobileToolbarAddon?: ReactNode;
  onRetry: () => void;
  studyReadOnly?: boolean;
};

export default function EmbedPdfViewer(props: StudyPdfPaneProps) {
  const [error, setError] = useState<PdfLoadError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [notePage, setNotePage] = useState(1);
  const latest = useRef(props);
  latest.current = props;
  const registryRef = useRef<PluginRegistry | null>(null);
  const annotationRef = useRef<AnnotationCapability | null>(null);
  const scrollRef = useRef<ScrollCapability | null>(null);
  const scrollPluginRef = useRef<ScrollPlugin | null>(null);
  const pageVisibilityStyle = useRef<HTMLStyleElement | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const syncing = useRef(false);
  const initialDataRestored = useRef(false);
  const opened = useRef(false);
  const lastEmittedJson = useRef(props.annotationsJson);
  const managedIds = useRef(new Set<string>());

  // No initial document: listeners must be registered before opening the buffer.
  const config = useMemo<PDFViewerConfig>(() => ({
    // Worker code runs from a blob URL; its fetch needs an absolute asset URL.
    wasmUrl: new URL(`/vendor/embedpdf/${embedPdfVersion}/pdfium.wasm`, window.location.origin).href,
    worker: true,
    tabBar: "never",
    theme: {
      preference: "dark",
      dark: {
        background: { app: "#25312e", surface: "#101b19", surfaceAlt: "#172522", elevated: "#20312d" },
        border: { default: "#354843", subtle: "#273a35" },
        accent: { primary: "#8ed9c9", primaryForeground: "#10231d" },
      },
    },
    fonts: { ui: null, signature: null },
    scroll: { defaultStrategy: ScrollStrategy.Horizontal, defaultPageGap: Math.max(window.innerWidth, window.screen.width) + 64, defaultBufferSize: 0 },
    viewport: { viewportGap: 0 },
    spread: { defaultSpreadMode: SpreadMode.None },
    zoom: { defaultZoomLevel: ZoomMode.FitPage },
    disabledCategories: ["document-open", "document-close", "redaction", "insert", "annotation-stamp", "document-protect", "form", "scroll", "spread", "navigation"],
    permissions: props.studyReadOnly ? { overrides: { modifyAnnotations: false, modifyContents: false } } : undefined,
    annotations: { annotationAuthor: "Student" },
  }), [props.studyReadOnly]);

  const showOnlyPage = useCallback((layout = scrollPluginRef.current?.getScrollerLayout(latest.current.bookId)) => {
    const style = pageVisibilityStyle.current;
    if (!style || !layout?.items.length) return;
    const index = layout.items.findIndex((item) => item.pageNumbers.includes(latest.current.currentPage));
    style.textContent = index < 0 ? "" : `${readerPages}:not(:nth-child(${index + 1})) { visibility: hidden; }`;
  }, []);

  const goToPage = useCallback((page: number) => {
    const total = scrollRef.current?.getTotalPages() || latest.current.totalPages || 1;
    const next = Math.min(total, Math.max(1, page));
    if (next === latest.current.currentPage) return;
    scrollRef.current?.scrollToPage({ pageNumber: next, behavior: "instant" });
    latest.current.onPageChange?.(next);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.composedPath().some((node) => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || /^(menu|menuitem|listbox|option)$/.test(node.getAttribute("role") || "")))) return;
      const current = scrollRef.current?.getCurrentPage() || latest.current.currentPage;
      if (event.key === "ArrowRight" || event.key === "PageDown") goToPage(current + 1);
      else if (event.key === "ArrowLeft" || event.key === "PageUp") goToPage(current - 1);
      else if (event.key === "Home") goToPage(1);
      else if (event.key === "End") goToPage(scrollRef.current?.getTotalPages() || current);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loaded, goToPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!opened.current) setError(new PdfLoadError("The PDF engine did not finish starting. Retry, or open the downloaded PDF while the viewer is unavailable.", "PDF_ENGINE_TIMEOUT", "render", true));
    }, 18_000);
    return () => { clearTimeout(timer); cleanupRef.current.forEach((unsubscribe) => unsubscribe()); cleanupRef.current = []; };
  }, []);

  const onReady = useCallback(async (registry: PluginRegistry) => {
    registryRef.current = registry;
    try {
      const documents = registry.getPlugin<DocumentManagerPlugin>("document-manager")?.provides();
      const annotations = registry.getPlugin<AnnotationPlugin>("annotation")?.provides();
      const scrollPlugin = registry.getPlugin<ScrollPlugin>("scroll");
      const scroll = scrollPlugin?.provides();
      const viewport = registry.getPlugin<ViewportPlugin>("viewport")?.provides();
      const zoom = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
      const ui = registry.getPlugin<UIPlugin>("ui")?.provides();
      const pageControls = ui?.getSchema().overlays?.["page-controls"];
      if (pageControls) ui?.mergeSchema({ overlays: { "page-controls": { ...pageControls, defaultEnabled: false } } });
      if (!documents || !annotations || !scroll) throw new Error("Required viewer plugins are unavailable.");
      annotationRef.current = annotations;
      scrollRef.current = scroll;
      scrollPluginRef.current = scrollPlugin ?? null;
      let frame = 0;
      const recenterAfterLayout = () => {
        if (!opened.current) return;
        const page = latest.current.currentPage;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (latest.current.currentPage !== page) return;
            const root = pageVisibilityStyle.current?.getRootNode();
            if (!(root instanceof ShadowRoot)) return;
            const pane = root.querySelector(readerViewport);
            const paper = Array.from(root.querySelectorAll(`${readerPages} > div`))
              .find((element) => getComputedStyle(element).visibility === "visible");
            if (pane && paper && paper.getBoundingClientRect().width <= pane.clientWidth) {
              scroll.scrollToPage({ pageNumber: page, behavior: "instant" });
            }
          });
        });
      };
      if (viewport) cleanupRef.current.push(viewport.onViewportResize(recenterAfterLayout));
      if (zoom) cleanupRef.current.push(zoom.onZoomChange(recenterAfterLayout));
      cleanupRef.current.push(() => cancelAnimationFrame(frame));
      cleanupRef.current.push(
        documents.onDocumentError((event) => {
          setError(new PdfLoadError("This PDF could not be displayed. Try opening the downloaded copy.", `PDF_ENGINE_${event.code ?? "OPEN"}`, "render", false));
        }),
        documents.onDocumentOpened((state) => {
          const document = state.document;
          if (!document) return;
          opened.current = true;
          if (scrollPlugin) cleanupRef.current.push(scrollPlugin.onScrollerData(state.id, showOnlyPage));
          latest.current.onNumPages(document.pageCount);
          syncing.current = true;
          try {
            const items = restoreViewerAnnotations(latest.current.annotationsJson, latest.current.highlights, document.pages);
            managedIds.current = new Set(items.map((item) => item.annotation.id));
            annotations.importAnnotations(items);
            initialDataRestored.current = true;
          } catch {
            setAnnotationError("Saved annotations could not be restored. Annotation autosave is paused to protect them. Your study notes and bookmarks are still available.");
          } finally {
            syncing.current = false;
          }
          setError(null);
          setLoaded(true);
        }),
        scroll.onLayoutReady((event) => {
          if (event.isInitial) scroll.scrollToPage({ pageNumber: latest.current.currentPage, behavior: "instant" });
          showOnlyPage();
        }),
        scroll.onPageChange((event) => {
          if (opened.current) latest.current.onPageChange?.(event.pageNumber);
        }),
        annotations.onAnnotationEvent((event) => {
          if (latest.current.studyReadOnly || syncing.current || !initialDataRestored.current || event.type === "loaded") return;
          if (event.type === "delete" && event.annotation.id.startsWith("portal-legacy-")) latest.current.onLegacyHighlightDelete(event.annotation.id.slice("portal-legacy-".length));
          // Plain annotation objects contain geometry and comments. Binary stamp
          // tools are disabled; JSON avoids Firestore's nested-array limitation.
          const items = annotations.getAnnotations().filter((item) => item.commitState !== "deleted").map((item) => ({ annotation: item.object }));
          managedIds.current = new Set(items.map((item) => item.annotation.id));
          lastEmittedJson.current = JSON.stringify(items);
          latest.current.onAnnotationsChange(lastEmittedJson.current);
        }),
      );
      const response = await fetch(latest.current.pdfBlobUrl);
      if (!response.ok) throw new Error("The downloaded PDF is no longer available in this tab.");
      const buffer = await response.arrayBuffer();
      await documents.openDocumentBuffer({ buffer, name: latest.current.title, documentId: latest.current.bookId }).toPromise();
    } catch {
      setError((previous) => previous ?? new PdfLoadError("The viewer could not open this PDF. Retry or open the downloaded copy.", "PDF_ENGINE_OPEN", "render", true));
    }
  }, [showOnlyPage]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (loaded && scroll && scroll.getCurrentPage() !== props.currentPage) scroll.scrollToPage({ pageNumber: props.currentPage, behavior: "instant" });
    if (loaded) showOnlyPage();
  }, [props.currentPage, loaded, showOnlyPage]);

  useEffect(() => {
    const api = annotationRef.current;
    if (!loaded || !api) return;
    const ids = new Set(props.highlights.map((h) => `portal-legacy-${h.id}`));
    syncing.current = true;
    try {
      for (const item of api.getAnnotations()) {
        if (item.object.id.startsWith("portal-legacy-") && !ids.has(item.object.id)) api.deleteAnnotation(item.object.pageIndex, item.object.id);
      }
    } finally { syncing.current = false; }
  }, [props.highlights, loaded]);

  useEffect(() => {
    const api = annotationRef.current;
    if (!loaded || !api || props.annotationsJson === lastEmittedJson.current) return;
    try {
      const saved = JSON.parse(props.annotationsJson || "[]") as Array<{annotation: {id: string}}>;
      const ids = new Set(saved.map((item) => item.annotation.id));
      syncing.current = true;
      for (const item of api.getAnnotations()) {
        if (managedIds.current.has(item.object.id) && !item.object.id.startsWith("portal-legacy-") && !ids.has(item.object.id)) api.deleteAnnotation(item.object.pageIndex, item.object.id);
      }
      lastEmittedJson.current = props.annotationsJson;
    } finally { syncing.current = false; }
  }, [props.annotationsJson, loaded]);

  const startNote = async () => {
    setNotePage(props.currentPage);
    const selection = registryRef.current?.getPlugin<SelectionPlugin>("selection")?.provides();
    try { setSelectedText((await selection?.getSelectedText().toPromise())?.join(" ") || ""); }
    catch { setSelectedText(""); }
    setNoteOpen(true);
  };

  return <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#25312e]">
    {annotationError && <p role="alert" className="bg-amber-950 p-3 text-xs text-amber-200">{annotationError}</p>}
    <div className="relative min-h-0 flex-1">
      <PDFViewer config={config} onReady={onReady} onInit={(container) => {
        const style = document.createElement("style");
        style.textContent = readerLayout;
        pageVisibilityStyle.current = document.createElement("style");
        container.shadowRoot?.append(style, pageVisibilityStyle.current);
      }} style={{ width: "100%", height: "100%" }} />
      {(!loaded || error) && <div className="absolute inset-0 z-30 flex bg-[#0b1110]">
        <PdfFeedback error={error} message="Opening your downloaded book…" onRetry={error ? props.onRetry : undefined} fileUrl={props.pdfBlobUrl} />
      </div>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1 sm:px-3">
      <nav aria-label="PDF page navigation" className="flex items-center gap-2 sm:gap-3">
        <button type="button" aria-label="Previous PDF page" aria-keyshortcuts="ArrowLeft PageUp" disabled={!loaded || props.currentPage <= 1} onClick={() => goToPage(props.currentPage - 1)} className="grid size-8 place-items-center rounded-md border border-white/15 bg-[#101b19] text-base text-white hover:bg-[#354843] focus-visible:outline-2 focus-visible:outline-[#8ed9c9] disabled:opacity-40">←</button>
        <form className="flex items-center gap-1 text-xs font-medium tabular-nums text-white/70" onSubmit={(event) => {
          event.preventDefault();
          const page = Number(new FormData(event.currentTarget).get("page"));
          if (Number.isInteger(page) && page > 0) goToPage(page);
        }}>
          <input key={props.currentPage} name="page" type="number" min={1} max={props.totalPages ?? undefined} defaultValue={props.currentPage} aria-label="Go to PDF page" disabled={!loaded} className="h-8 w-10 rounded-md bg-[#101b19] text-center text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span aria-live="polite">/ {props.totalPages || "—"}</span>
        </form>
        <button type="button" aria-label="Next PDF page" aria-keyshortcuts="ArrowRight PageDown" disabled={!loaded || props.currentPage >= (props.totalPages || 1)} onClick={() => goToPage(props.currentPage + 1)} className="grid size-8 place-items-center rounded-md border border-white/15 bg-[#101b19] text-base text-white hover:bg-[#354843] focus-visible:outline-2 focus-visible:outline-[#8ed9c9] disabled:opacity-40">→</button>
      </nav>
      <div className="flex items-center gap-2">
        <button type="button" disabled={!loaded || noteOpen || props.studyReadOnly} onClick={() => void startNote()} className="min-h-8 rounded-md border border-[#8ed9c9]/25 bg-[#101b19] px-2.5 text-xs font-semibold text-[#b9eee2] hover:bg-[#354843] focus-visible:outline-2 focus-visible:outline-[#8ed9c9] disabled:opacity-40">Add note</button>
        <span className="lg:hidden">{props.mobileToolbarAddon}</span>
      </div>
    </div>
    {noteOpen && <form className="shrink-0 space-y-2 border-t border-white/10 p-3 text-sm" onSubmit={(event) => {
      event.preventDefault();
      if (!noteText.trim()) return;
      props.onNote?.(selectedText, noteText.trim(), notePage);
      setNoteText(""); setNoteOpen(false);
    }}>
      <label htmlFor="pdf-study-note" className="text-white/70">Study note · page {notePage}</label>
      {selectedText && <p className="line-clamp-2 text-xs text-white/50">Selected: {selectedText}</p>}
      <textarea id="pdf-study-note" required autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} className="w-full rounded border border-white/20 bg-black/20 p-2 text-white" />
      <button type="submit" className="mr-3 rounded bg-[#26d9c0] px-3 py-1 text-black">Save note</button>
      <button type="button" onClick={() => setNoteOpen(false)} className="text-white/60">Cancel</button>
    </form>}
  </div>;
}
