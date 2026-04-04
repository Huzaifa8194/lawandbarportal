"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

/**
 * Mobile browsers often cannot render PDFs inside an iframe when the URL is a blob:
 * they show a placeholder, an opaque ID, and an "Open" button instead.
 * PDF.js (react-pdf) draws to canvas and works reliably on iOS / Android.
 */
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

type StudyPdfPaneProps = {
  bookId: string;
  pdfBlobUrl: string;
  iframePdfUrl: string;
  title: string;
  currentPage: number;
  onNumPages: (n: number) => void;
};

export default function StudyPdfPane({
  bookId,
  pdfBlobUrl,
  iframePdfUrl,
  title,
  currentPage,
  onNumPages,
}: StudyPdfPaneProps) {
  const preferPdfJs = usePreferPdfJsViewer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(320);

  useEffect(() => {
    if (!preferPdfJs || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPageWidth(Math.max(240, Math.floor(w - 16)));
    });
    ro.observe(el);
    setPageWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width - 16)));
    return () => ro.disconnect();
  }, [preferPdfJs]);

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

  if (preferPdfJs) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg bg-[#e8e6e1]"
        >
          <Document
            key={bookId}
            file={pdfBlobUrl}
            loading={
              <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-slate-600">
                Rendering PDF…
              </div>
            }
            error={
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-700">
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
        </div>
        <div className="shrink-0 px-1 pt-2 text-center">{openExternal}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden rounded-lg">
      <iframe
        key={bookId}
        src={iframePdfUrl}
        title={title}
        className="h-full min-h-[480px] w-full bg-white"
      />
    </div>
  );
}
