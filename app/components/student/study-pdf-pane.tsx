"use client";

import dynamic from "next/dynamic";
import { Component, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PdfLoadError } from "@/lib/pdf-errors";
import PdfFeedback from "./pdf-feedback";
import type { StudyPdfPaneProps } from "./embed-pdf-viewer";

const ViewerFile = createContext<string | undefined>(undefined);

function ViewerLoading() {
  const fileUrl = useContext(ViewerFile);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(timer);
  }, []);
  const error = timedOut ? new PdfLoadError("The viewer took too long to start. You can open the downloaded book below.", "PDF_VIEWER_TIMEOUT", "render") : null;
  return <PdfFeedback error={error} message="Loading the PDF viewer…" fileUrl={fileUrl} />;
}

const Viewer = dynamic(() => import("./embed-pdf-viewer"), {
  ssr: false,
  loading: ViewerLoading,
});

class ViewerBoundary extends Component<{ children: ReactNode; onRetry: () => void; fileUrl: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <PdfFeedback error={new PdfLoadError("The PDF viewer could not start. Reload the viewer or open the downloaded PDF.", "PDF_VIEWER_START", "render", true)} onRetry={this.props.onRetry} fileUrl={this.props.fileUrl} />;
    return this.props.children;
  }
}

export default function StudyPdfPane(props: StudyPdfPaneProps) {
  return <ViewerFile.Provider value={props.pdfBlobUrl}><ViewerBoundary key={`${props.bookId}-${props.pdfBlobUrl}`} onRetry={props.onRetry} fileUrl={props.pdfBlobUrl}><Viewer {...props} /></ViewerBoundary></ViewerFile.Provider>;
}
