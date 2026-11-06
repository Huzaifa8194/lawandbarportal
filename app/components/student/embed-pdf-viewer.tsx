"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PDFViewer, version as embedPdfVersion, AnnotationPlugin, DocumentManagerPlugin, ScrollPlugin, SelectionPlugin, type PluginRegistry, type PDFViewerConfig, type AnnotationCapability, type ScrollCapability } from "@embedpdf/react-pdf-viewer";
import { PdfLoadError } from "@/lib/pdf-errors";
import { restoreViewerAnnotations } from "@/lib/pdf-annotations";
import type { PdfHighlight } from "@/lib/types/student";
import PdfFeedback from "./pdf-feedback";

export type StudyPdfPaneProps = {
  bookId: string;
  pdfBlobUrl: string;
  title: string;
  currentPage: number;
  totalPages?: number | null;
  onPageChange?: (page: number) => void;
  onNumPages: (n: number) => void;
  onNote?: (selectedText: string, content: string) => void;
  highlights: PdfHighlight[];
  annotationsJson: string;
  onAnnotationsChange: (json: string) => void;
  onLegacyHighlightDelete: (id: string) => void;
  mobileToolbarAddon?: ReactNode;
  onRetry: () => void;
};

export default function EmbedPdfViewer(props: StudyPdfPaneProps) {
  const [error, setError] = useState<PdfLoadError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const latest = useRef(props);
  latest.current = props;
  const registryRef = useRef<PluginRegistry | null>(null);
  const annotationRef = useRef<AnnotationCapability | null>(null);
  const scrollRef = useRef<ScrollCapability | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const syncing = useRef(false);
  const initialDataRestored = useRef(false);
  const opened = useRef(false);

  // No initial document: listeners must be registered before opening the buffer.
  const config = useMemo<PDFViewerConfig>(() => ({
    wasmUrl: `/vendor/embedpdf/${embedPdfVersion}/pdfium.wasm`,
    worker: true,
    tabBar: "never",
    theme: { preference: "dark" },
    fonts: { ui: null, signature: null },
    disabledCategories: ["document-open", "document-close", "redaction", "insert", "annotation-stamp", "document-protect", "form"],
    annotations: { annotationAuthor: "Student" },
  }), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!opened.current) setError(new PdfLoadError("The PDF engine did not finish starting. Retry, or open the downloaded PDF while the viewer is unavailable.", "PDF_ENGINE_TIMEOUT", "render", true));
    }, 45_000);
    return () => { clearTimeout(timer); cleanupRef.current.forEach((unsubscribe) => unsubscribe()); cleanupRef.current = []; };
  }, []);

  const onReady = useCallback(async (registry: PluginRegistry) => {
    registryRef.current = registry;
    try {
      const documents = registry.getPlugin<DocumentManagerPlugin>("document-manager")?.provides();
      const annotations = registry.getPlugin<AnnotationPlugin>("annotation")?.provides();
      const scroll = registry.getPlugin<ScrollPlugin>("scroll")?.provides();
      if (!documents || !annotations || !scroll) throw new Error("Required viewer plugins are unavailable.");
      annotationRef.current = annotations;
      scrollRef.current = scroll;
      cleanupRef.current.push(
        documents.onDocumentError((event) => {
          setError(new PdfLoadError(`The PDF engine could not open this file: ${event.message}`, `PDF_ENGINE_${event.code ?? "OPEN"}`, "render", false));
        }),
        documents.onDocumentOpened((state) => {
          const document = state.document;
          if (!document) return;
          opened.current = true;
          latest.current.onNumPages(document.pageCount);
          syncing.current = true;
          try {
            const items = restoreViewerAnnotations(latest.current.annotationsJson, latest.current.highlights, document.pages);
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
        }),
        scroll.onPageChange((event) => {
          if (opened.current) latest.current.onPageChange?.(event.pageNumber);
        }),
        annotations.onAnnotationEvent((event) => {
          if (syncing.current || !initialDataRestored.current || event.type === "loaded") return;
          if (event.type === "delete" && event.annotation.id.startsWith("portal-legacy-")) latest.current.onLegacyHighlightDelete(event.annotation.id.slice("portal-legacy-".length));
          // Plain annotation objects contain geometry and comments. Binary stamp
          // tools are disabled; JSON avoids Firestore's nested-array limitation.
          const items = annotations.getAnnotations().filter((item) => item.commitState !== "deleted").map((item) => ({ annotation: item.object }));
          latest.current.onAnnotationsChange(JSON.stringify(items));
        }),
      );
      const response = await fetch(latest.current.pdfBlobUrl);
      if (!response.ok) throw new Error("The downloaded PDF is no longer available in this tab.");
      const buffer = await response.arrayBuffer();
      await documents.openDocumentBuffer({ buffer, name: latest.current.title, documentId: latest.current.bookId }).toPromise();
    } catch (cause) {
      setError(new PdfLoadError(cause instanceof Error ? cause.message : "The PDF engine could not start.", "PDF_ENGINE_OPEN", "render", true));
    }
  }, []);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (loaded && scroll && scroll.getCurrentPage() !== props.currentPage) scroll.scrollToPage({ pageNumber: props.currentPage, behavior: "instant" });
  }, [props.currentPage, loaded]);

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

  const startNote = async () => {
    const selection = registryRef.current?.getPlugin<SelectionPlugin>("selection")?.provides();
    try { setSelectedText((await selection?.getSelectedText().toPromise())?.join(" ") || ""); }
    catch { setSelectedText(""); }
    setNoteOpen(true);
  };

  return <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1110]">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-white/65">
      <span className="truncate">{props.title}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" disabled={!loaded} onClick={() => void startNote()} className="rounded border border-white/20 px-2 py-1 text-white disabled:opacity-40">Add study note</button>
        <span className="lg:hidden">{props.mobileToolbarAddon}</span>
      </div>
    </div>
    {annotationError && <p role="alert" className="bg-amber-950 p-3 text-xs text-amber-200">{annotationError}</p>}
    <div className="relative min-h-0 flex-1">
      <PDFViewer config={config} onReady={onReady} style={{ width: "100%", height: "100%" }} />
      {(!loaded || error) && <div className="absolute inset-0 z-30 flex bg-[#0b1110]">
        <PdfFeedback error={error} message="Starting the PDF engine and opening your downloaded book…" onRetry={error ? props.onRetry : undefined} fileUrl={error ? props.pdfBlobUrl : undefined} />
      </div>}
    </div>
    {noteOpen && <form className="shrink-0 space-y-2 border-t border-white/10 p-3 text-sm" onSubmit={(event) => {
      event.preventDefault();
      if (!noteText.trim()) return;
      props.onNote?.(selectedText, noteText.trim());
      setNoteText(""); setNoteOpen(false);
    }}>
      <label htmlFor="pdf-study-note" className="text-white/70">Study note · page {props.currentPage}</label>
      {selectedText && <p className="line-clamp-2 text-xs text-white/50">Selected: {selectedText}</p>}
      <textarea id="pdf-study-note" required autoFocus value={noteText} onChange={(event) => setNoteText(event.target.value)} className="w-full rounded border border-white/20 bg-black/20 p-2 text-white" />
      <button type="submit" className="mr-3 rounded bg-[#26d9c0] px-3 py-1 text-black">Save note</button>
      <button type="button" onClick={() => setNoteOpen(false)} className="text-white/60">Cancel</button>
    </form>}
  </div>;
}
