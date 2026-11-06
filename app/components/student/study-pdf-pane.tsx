"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { PdfLoadError } from "@/lib/pdf-errors";
import PdfFeedback from "./pdf-feedback";
import type { StudyPdfPaneProps } from "./embed-pdf-viewer";

const Viewer = dynamic(() => import("./embed-pdf-viewer"), {
  ssr: false,
  loading: () => <PdfFeedback message="Loading the PDF viewer…" />,
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
  return <ViewerBoundary key={`${props.bookId}-${props.pdfBlobUrl}`} onRetry={props.onRetry} fileUrl={props.pdfBlobUrl}><Viewer {...props} /></ViewerBoundary>;
}
