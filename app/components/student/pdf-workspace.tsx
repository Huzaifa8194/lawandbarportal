"use client";

import { useEffect, useMemo, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import type { PdfBookmark, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function PdfWorkspace({
  bookId,
  title,
  fileUrl,
}: {
  bookId: string;
  title: string;
  fileUrl: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<PdfBookmark[]>([]);
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [highlightText, setHighlightText] = useState("");
  const [highlightColor, setHighlightColor] = useState<PdfHighlight["color"]>("yellow");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = (await studentApi.getPdfState(bookId)) as PdfStudyState | null;
        if (!saved) return;
        setCurrentPage(saved.currentPage || 1);
        setBookmarks(saved.bookmarks || []);
        setNotes(saved.notes || []);
        setHighlights(saved.highlights || []);
      } finally {
        setReady(true);
      }
    };
    load().catch(() => setReady(true));
  }, [bookId]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      studentApi
        .savePdfState(bookId, { currentPage, bookmarks, notes, highlights })
        .catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [bookId, bookmarks, currentPage, highlights, notes, ready]);

  const embeddedUrl = useMemo(() => `${fileUrl}#page=${currentPage}`, [currentPage, fileUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.open(fileUrl, "_blank")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            Download
          </button>
          <button
            onClick={() => window.open(fileUrl, "_blank")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            Print
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Prev
        </button>
        <input
          type="number"
          min={1}
          value={currentPage}
          onChange={(event) => setCurrentPage(Math.max(1, Number(event.target.value || 1)))}
          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Next
        </button>
        <button
          onClick={() =>
            setBookmarks((prev) => [
              { id: uid(), page: currentPage, label: `Page ${currentPage}`, createdAt: new Date().toISOString() },
              ...prev,
            ])
          }
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Bookmark Page
        </button>
      </div>

      <iframe
        src={embeddedUrl}
        title={title}
        className="h-[520px] w-full rounded-xl border border-slate-200 bg-white"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Bookmarks</h4>
          <div className="mt-2 space-y-2">
            {bookmarks.slice(0, 8).map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.page)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Notes</h4>
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add note for current page"
            className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              if (!noteText.trim()) return;
              setNotes((prev) => [
                { id: uid(), page: currentPage, text: noteText.trim(), createdAt: new Date().toISOString() },
                ...prev,
              ]);
              setNoteText("");
            }}
            className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            Save Note
          </button>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Highlights</h4>
          <input
            value={highlightText}
            onChange={(event) => setHighlightText(event.target.value)}
            placeholder="Highlighted text snippet"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={highlightColor}
            onChange={(event) => setHighlightColor(event.target.value as PdfHighlight["color"])}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="pink">Pink</option>
          </select>
          <button
            onClick={() => {
              if (!highlightText.trim()) return;
              setHighlights((prev) => [
                {
                  id: uid(),
                  page: currentPage,
                  text: highlightText.trim(),
                  color: highlightColor,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setHighlightText("");
            }}
            className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
          >
            Save Highlight
          </button>
        </section>
      </div>
    </div>
  );
}
