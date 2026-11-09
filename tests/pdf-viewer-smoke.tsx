import { createRoot } from "react-dom/client";
import { useState } from "react";
import Viewer from "../app/components/student/embed-pdf-viewer";

function SmokeTest() {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [annotations, setAnnotations] = useState(localStorage.getItem("pdf-smoke-annotations") || "");
  const [note, setNote] = useState("");
  return <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0b1110", color: "white" }}>
    <div id="test-status">Page {page}/{pages} · Saved annotations: {annotations ? JSON.parse(annotations).length : 0} · Study note: {note}</div>
    <div style={{flex: 1, minHeight: 0}}><Viewer
      bookId="fixture" title="PDF integration fixture" pdfBlobUrl={location.search.includes("invalid") ? "/invalid.pdf" : "/fixture.pdf"}
      currentPage={page} totalPages={pages} onPageChange={setPage} onNumPages={setPages}
      annotationsJson={annotations} highlights={[]}
      onAnnotationsChange={(json) => { setAnnotations(json); localStorage.setItem("pdf-smoke-annotations", json); }}
      onLegacyHighlightDelete={() => {}} onNote={(_, content) => setNote(content)} onRetry={() => location.reload()}
    /></div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<SmokeTest />);
