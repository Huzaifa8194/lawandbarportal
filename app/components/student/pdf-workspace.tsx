"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import type { PdfBookmark, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const highlightStyles: Record<PdfHighlight["color"], string> = {
  yellow: "bg-yellow-100 border-yellow-300",
  green: "bg-green-100 border-green-200",
  blue: "bg-blue-100 border-blue-200",
  pink: "bg-pink-100 border-pink-200",
};

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
  const [saveHint, setSaveHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const saved = (await studentApi.getPdfState(bookId)) as PdfStudyState | null;
        if (cancelled) return;
        if (!saved) {
          setReady(true);
          return;
        }
        setCurrentPage(saved.currentPage || 1);
        setBookmarks(Array.isArray(saved.bookmarks) ? saved.bookmarks : []);
        setNotes(Array.isArray(saved.notes) ? saved.notes : []);
        setHighlights(Array.isArray(saved.highlights) ? saved.highlights : []);
      } catch {
        setSaveHint("Could not load your saved notes. Check you are logged in with access.");
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const persistState = useCallback(async () => {
    try {
      await studentApi.savePdfState(bookId, {
        bookId,
        currentPage,
        bookmarks,
        notes,
        highlights,
        updatedAt: new Date().toISOString(),
      });
      setSaveHint(null);
    } catch {
      setSaveHint("Could not save. Please try again or refresh the page.");
    }
  }, [bookId, bookmarks, currentPage, highlights, notes]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void persistState();
    }, 600);
    return () => clearTimeout(timer);
  }, [bookId, bookmarks, currentPage, highlights, notes, ready, persistState]);

  const embeddedUrl = useMemo(() => `${fileUrl}#page=${currentPage}`, [currentPage, fileUrl]);

  const addHighlight = () => {
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
    setSaveHint("Highlight added — saved automatically.");
  };

  const removeHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const pageHighlights = highlights.filter((h) => h.page === currentPage);

  return (
    <div className="space-y-4">
      {saveHint ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {saveHint}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={fileUrl}
            download
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            Download
          </a>
          <button
            type="button"
            onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => window.open(embeddedUrl, "_blank", "noopener,noreferrer")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm md:hidden"
          >
            Full screen PDF
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600 md:hidden">
        On small screens, use &quot;Full screen PDF&quot; for easier reading. Highlights below are
        saved to your account (text you type or paste from the PDF).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm touch-manipulation"
        >
          Prev
        </button>
        <input
          type="number"
          min={1}
          value={currentPage}
          onChange={(event) => setCurrentPage(Math.max(1, Number(event.target.value || 1)))}
          className="w-24 min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Page number"
        />
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm touch-manipulation"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() =>
            setBookmarks((prev) => [
              {
                id: uid(),
                page: currentPage,
                label: `Page ${currentPage}`,
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ])
          }
          className="min-h-[44px] rounded-lg bg-slate-900 px-3 py-2 text-sm text-white touch-manipulation"
        >
          Bookmark page
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto overflow-y-hidden md:mx-0">
        <div className="min-h-[min(70vh,520px)] w-full min-w-0 md:min-h-[520px]">
          <iframe
            src={embeddedUrl}
            title={title}
            className="h-[min(70vh,520px)] w-full min-h-[280px] rounded-xl border border-slate-200 bg-white md:h-[520px]"
            style={{ WebkitOverflowScrolling: "touch" }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Bookmarks</h4>
          <div className="mt-2 space-y-2">
            {bookmarks.length === 0 ? (
              <p className="text-sm text-slate-500">No bookmarks yet.</p>
            ) : null}
            {bookmarks.slice(0, 12).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentPage(item.page)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm touch-manipulation"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Notes (this page)</h4>
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add a note for the current page"
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!noteText.trim()) return;
              setNotes((prev) => [
                {
                  id: uid(),
                  page: currentPage,
                  text: noteText.trim(),
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setNoteText("");
            }}
            className="mt-2 min-h-[44px] rounded-lg bg-slate-900 px-3 py-2 text-sm text-white touch-manipulation"
          >
            Save note
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold">Highlights</h4>
          <p className="mt-1 text-xs text-slate-500">
            Copy text from the PDF, paste here, pick a color, then save. Your highlights appear
            below and sync across devices.
          </p>
          <input
            value={highlightText}
            onChange={(event) => setHighlightText(event.target.value)}
            placeholder="Paste or type the passage to highlight"
            className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            type="button"
            onClick={addHighlight}
            className="mt-2 min-h-[44px] w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white touch-manipulation"
          >
            Save highlight
          </button>

          {pageHighlights.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">On this page</p>
              {pageHighlights.map((h) => (
                <div
                  key={h.id}
                  className={`rounded-lg border px-2 py-2 text-sm ${highlightStyles[h.color]}`}
                >
                  <p className="text-slate-800">{h.text}</p>
                  <button
                    type="button"
                    onClick={() => removeHighlight(h.id)}
                    className="mt-1 text-xs text-slate-600 underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {highlights.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-600">All highlights ({highlights.length})</p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {highlights.map((h) => (
                  <li
                    key={h.id}
                    className={`flex flex-col gap-1 rounded-lg border px-2 py-2 text-sm ${highlightStyles[h.color]}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">Page {h.page}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-slate-700 underline"
                          onClick={() => setCurrentPage(h.page)}
                        >
                          Go to page
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => removeHighlight(h.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-800">{h.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No highlights yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
