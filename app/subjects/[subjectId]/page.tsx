"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import type { AudioStudyState, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";
import StudyPdfPane from "@/app/components/student/study-pdf-pane";
import StudentAssistant from "@/app/components/student-assistant";
import { usePortalLiveData } from "../../lib/use-portal-live";
import { useAuth } from "../../context/auth-context";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

type PanelTab = "notes" | "highlights" | "bookmarks";

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
  const pathname = usePathname();
  const { user } = useAuth();
  const { subjects, books, audios, videos, mocks, loading } = usePortalLiveData({ includeAttempts: false });
  const subject = subjects.find((item) => item.id === params.subjectId);

  const booksForSubject = useMemo(() => {
    return books
      .filter((item) => item.subjectId === params.subjectId)
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });
  }, [books, params.subjectId]);

  const [selectedBookId, setSelectedBookId] = useState("");

  useEffect(() => {
    if (!booksForSubject.length) {
      setSelectedBookId("");
      return;
    }
    setSelectedBookId((prev) =>
      prev && booksForSubject.some((b) => b.id === prev) ? prev : booksForSubject[0].id,
    );
  }, [params.subjectId, booksForSubject]);

  const relatedBook =
    booksForSubject.find((b) => b.id === selectedBookId) ?? booksForSubject[0];
  const relatedBookId = typeof relatedBook?.id === "string" ? relatedBook.id.trim() : "";
  const relatedAudios = audios.filter((item) => item.subjectId === params.subjectId);
  const relatedVideos = videos.filter((item) => item.subjectId === params.subjectId);
  const relatedMocks = mocks.filter((item) => item.subjectIds.includes(params.subjectId));

  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const normalizedWorkspaceQuery = workspaceQuery.trim().toLowerCase();
  const filteredAudios = useMemo(() => {
    if (!normalizedWorkspaceQuery) return relatedAudios;
    return relatedAudios.filter((audio) => audio.title.toLowerCase().includes(normalizedWorkspaceQuery));
  }, [relatedAudios, normalizedWorkspaceQuery]);
  const filteredVideos = useMemo(() => {
    if (!normalizedWorkspaceQuery) return relatedVideos;
    return relatedVideos.filter((video) => {
      const titleMatch = video.title.toLowerCase().includes(normalizedWorkspaceQuery);
      const descriptionMatch = (video.description || "").toLowerCase().includes(normalizedWorkspaceQuery);
      return titleMatch || descriptionMatch;
    });
  }, [relatedVideos, normalizedWorkspaceQuery]);
  const filteredMocks = useMemo(() => {
    if (!normalizedWorkspaceQuery) return relatedMocks;
    return relatedMocks.filter((mock) => mock.title.toLowerCase().includes(normalizedWorkspaceQuery));
  }, [relatedMocks, normalizedWorkspaceQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Array<{ id: string; page: number; label: string }>>([]);
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const pdfBlobRef = useRef<string | null>(null);
  const lastLoadedBookRef = useRef<string | null>(null);

  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(relatedAudios[0]?.id ?? null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioRate, setAudioRate] = useState(1);
  const [audioReady, setAudioReady] = useState(false);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPickerRef = useRef<HTMLDivElement | null>(null);

  // Side panel state
  const [showPanel, setShowPanel] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("notes");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      // Keep notes panel open by default on desktop.
      if (desktop) setShowPanel(true);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setSelectedAudioId((prev) =>
      prev && filteredAudios.some((audio) => audio.id === prev) ? prev : filteredAudios[0]?.id ?? null,
    );
  }, [filteredAudios]);

  useEffect(() => {
    // Only force-close if there are no available audios.
    if (!filteredAudios.length) setShowAudioPicker(false);
  }, [filteredAudios.length]);

  useEffect(() => {
    setSelectedVideoId((prev) =>
      prev && filteredVideos.some((video) => video.id === prev) ? prev : filteredVideos[0]?.id ?? null,
    );
  }, [filteredVideos]);

  useEffect(() => {
    if (!showAudioPicker) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (audioPickerRef.current && target && audioPickerRef.current.contains(target)) return;
      setShowAudioPicker(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [showAudioPicker]);

  // ── PDF blob loading ──
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadPdfBlob = async () => {
      if (!relatedBookId) {
        setPdfLoading(false);
        setPdfLoadError(null);
        if (pdfBlobRef.current) {
          URL.revokeObjectURL(pdfBlobRef.current);
          pdfBlobRef.current = null;
        }
        setPdfBlobUrl(null);
        lastLoadedBookRef.current = null;
        return;
      }
      if (!user) return;
      if (lastLoadedBookRef.current !== relatedBookId && pdfBlobRef.current) {
        URL.revokeObjectURL(pdfBlobRef.current);
        pdfBlobRef.current = null;
        setPdfBlobUrl(null);
      }
      lastLoadedBookRef.current = relatedBookId;

      setPdfLoading(true);
      setPdfLoadError(null);
      try {
        let loaded = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const token = await user.getIdToken(attempt > 0);
          const response = await fetch(`/api/student/books/${encodeURIComponent(relatedBookId)}/file`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            cache: "no-store",
          });
          if (response.ok) {
            const blob = await response.blob();
            if (cancelled) return;
            const nextUrl = URL.createObjectURL(blob);
            if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
            pdfBlobRef.current = nextUrl;
            setPdfBlobUrl(nextUrl);
            loaded = true;
            break;
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
          }
        }
        if (!loaded && !cancelled) {
          setPdfLoadError("PDF could not be loaded right now. Tap retry.");
        }
      } catch {
        if (!cancelled) {
          setPdfLoadError("PDF could not be loaded right now. Tap retry.");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    void loadPdfBlob();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [relatedBookId, user, pdfReloadKey]);

  useEffect(() => {
    setPdfNumPages(null);
  }, [relatedBookId]);

  useEffect(() => {
    if (pdfNumPages != null && currentPage > pdfNumPages) {
      setCurrentPage(pdfNumPages);
    }
  }, [pdfNumPages, currentPage]);

  useEffect(() => {
    return () => {
      if (pdfBlobRef.current) {
        URL.revokeObjectURL(pdfBlobRef.current);
        pdfBlobRef.current = null;
      }
    };
  }, []);

  // ── PDF study state persistence ──
  useEffect(() => {
    if (!relatedBook?.id) {
      setPdfReady(false);
      setCurrentPage(1);
      setBookmarks([]);
      setNotes([]);
      setHighlights([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setPdfReady(false);
      try {
        const saved = (await studentApi.getPdfState(relatedBook.id)) as PdfStudyState | null;
        if (cancelled) return;
        if (saved) {
          setCurrentPage(saved.currentPage || 1);
          setBookmarks(Array.isArray(saved.bookmarks) ? saved.bookmarks : []);
          setNotes(Array.isArray(saved.notes) ? saved.notes : []);
          setHighlights(Array.isArray(saved.highlights) ? saved.highlights : []);
        } else {
          setCurrentPage(1);
          setBookmarks([]);
          setNotes([]);
          setHighlights([]);
        }
        setPdfMessage(null);
      } catch {
        if (!cancelled) setPdfMessage("Could not load saved study notes. You can still continue studying.");
      } finally {
        if (!cancelled) setPdfReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [relatedBook?.id]);

  useEffect(() => {
    if (!relatedBook?.id || !pdfReady) return;
    const timer = setTimeout(() => {
      studentApi
        .savePdfState(relatedBook.id, {
          bookId: relatedBook.id,
          currentPage,
          bookmarks,
          notes,
          highlights,
          updatedAt: new Date().toISOString(),
        })
        .then(() => setPdfMessage(null))
        .catch(() => setPdfMessage("Could not autosave. Your current changes are local until retry succeeds."));
    }, 700);
    return () => clearTimeout(timer);
  }, [relatedBook?.id, pdfReady, currentPage, bookmarks, notes, highlights]);

  // ── Audio state persistence ──
  useEffect(() => {
    if (!selectedAudioId) {
      setAudioReady(false);
      setAudioPosition(0);
      setAudioRate(1);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setAudioReady(false);
      try {
        const saved = (await studentApi.getAudioState(selectedAudioId)) as AudioStudyState | null;
        if (cancelled) return;
        setAudioPosition(saved?.currentSeconds || 0);
        setAudioRate(saved?.playbackRate || 1);
        setAudioMessage(null);
      } catch {
        if (!cancelled) setAudioMessage("Could not load saved audio position.");
      } finally {
        if (!cancelled) setAudioReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedAudioId]);

  useEffect(() => {
    if (!selectedAudioId || !audioReady) return;
    const timer = setTimeout(() => {
      studentApi
        .saveAudioState(selectedAudioId, {
          currentSeconds: Math.floor(audioPosition),
          playbackRate: audioRate,
          updatedAt: new Date().toISOString(),
        })
        .then(() => setAudioMessage(null))
        .catch(() => setAudioMessage("Could not save audio progress right now."));
    }, 700);
    return () => clearTimeout(timer);
  }, [selectedAudioId, audioReady, audioPosition, audioRate]);

  // ── Derived data ──
  const selectedAudio = useMemo(
    () => filteredAudios.find((audio) => audio.id === selectedAudioId) ?? null,
    [filteredAudios, selectedAudioId],
  );
  const selectedVideo = useMemo(
    () => relatedVideos.find((video) => video.id === selectedVideoId) ?? null,
    [relatedVideos, selectedVideoId],
  );
  const pageHighlights = highlights.filter((item) => item.page === currentPage);
  const pageNotes = notes.filter((item) => item.page === currentPage);
  const pdfUrl = relatedBookId ? pdfBlobUrl : null;
  const trackRoot = pathname.startsWith("/books/") ? "/books" : "/subjects";
  const backTrackHref = subject?.track === "FLK 2" ? `${trackRoot}/flk2` : `${trackRoot}/flk1`;

  const addNote = () => {
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
  };

  // ── Render ──
  if (!loading && !subject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1716] p-6">
        <div className="max-w-md rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
          Subject not found or not published.
          <Link href="/subjects/flk1" className="mt-3 block text-[#26d9c0] underline">
            Back to subjects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1716] text-white">
      {/* ── Compact header (single row) ── */}
      <header
        className="sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#0f1716]/95 px-3 backdrop-blur sm:px-4"
        style={{ paddingTop: "calc(10px + env(safe-area-inset-top, 0px))", paddingBottom: 10 }}
      >
        <Link
          href={backTrackHref}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
          aria-label="Back"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
            {subject?.name || "Study Workspace"}
          </h1>
          <p className="truncate text-[10px] text-white/40 sm:text-[11px]">
            {subject?.track || "FLK"} &middot; {relatedBook?.title || "No book"}
          </p>
        </div>

        {/* Book switcher (when multiple books) */}
        {booksForSubject.length > 1 && (
          <select
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="hidden max-w-[180px] truncate rounded-lg border border-white/15 bg-[#0d1514] px-2 py-1 text-xs text-white sm:block"
          >
            {booksForSubject.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        )}

        {/* Audio selector */}
        {filteredAudios.length > 0 && (
          <select
            value={selectedAudioId || ""}
            onChange={(e) => setSelectedAudioId(e.target.value || null)}
            className="hidden max-w-[160px] truncate rounded-lg border border-white/15 bg-[#0d1514] px-2 py-1 text-xs text-white sm:block"
          >
            {filteredAudios.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        )}

        {/* Panel counts + toggle (desktop only) */}
        <div className="flex shrink-0 items-center gap-1">
          {pageHighlights.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-[#26d9c0]/15 text-[10px] font-bold text-[#6cf4e0]">
              {pageHighlights.length}
            </span>
          )}
          {pageNotes.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-300">
              {pageNotes.length}
            </span>
          )}
          {isDesktop && (
            <button
              type="button"
              onClick={() => setShowPanel((v) => !v)}
              title="Notes &amp; highlights panel"
              className={`hidden size-8 items-center justify-center rounded-md border transition lg:flex ${
                showPanel
                  ? "border-[#26d9c0]/50 bg-[#26d9c0]/15 text-[#6cf4e0]"
                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {pdfMessage ? <p className="shrink-0 bg-amber-900/30 px-4 py-1.5 text-xs text-amber-300">{pdfMessage}</p> : null}
      {audioMessage ? <p className="shrink-0 bg-amber-900/30 px-4 py-1 text-xs text-amber-300">{audioMessage}</p> : null}

      {/* ── Main area: PDF + side panel ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PDF column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {subject && relatedBook && pdfUrl ? (
            <StudyPdfPane
              bookId={relatedBookId}
              pdfBlobUrl={pdfUrl}
              title={relatedBook?.title || "Study Book PDF"}
              currentPage={currentPage}
              totalPages={pdfNumPages}
              onPageChange={setCurrentPage}
              onNumPages={setPdfNumPages}
              onHighlight={(text, color, rects) => {
                setHighlights((prev) => [
                  {
                    id: uid(),
                    page: currentPage,
                    text,
                    color,
                    rects,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }}
              onNote={(selectedText, noteContent) => {
                setNotes((prev) => [
                  {
                    id: uid(),
                    page: currentPage,
                    text: noteContent,
                    selectedText,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }}
              pageHighlights={pageHighlights}
            />
          ) : subject && relatedBook ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm rounded-xl border border-white/15 bg-white/5 p-6 text-center text-sm text-white/70">
                <p>{pdfLoading ? "Loading PDF..." : pdfLoadError || "Preparing your PDF..."}</p>
                <button
                  type="button"
                  onClick={() => setPdfReloadKey((prev) => prev + 1)}
                  className="mt-3 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : subject ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/50">
              No PDF book available for this subject yet.
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-white/40">
              Loading...
            </div>
          )}
        </div>

        {/* ── Side panel (desktop: beside PDF, mobile: bottom drawer overlay) ── */}
        {showPanel && (
          <>
            {/* Mobile backdrop */}
            <button
              type="button"
              onClick={() => setShowPanel(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              aria-label="Close panel"
            />
            <div
              className={
                "fixed bottom-0 left-0 right-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-white/10 bg-[#0d1514] " +
                "lg:static lg:z-auto lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-none lg:rounded-l-none lg:border-l lg:border-t-0"
              }
            >
              {/* Panel header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
                <div className="flex items-center gap-1">
                  {(["notes", "highlights", "bookmarks"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPanelTab(tab)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                        panelTab === tab
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white/75"
                      }`}
                    >
                      {tab}
                      {tab === "notes" && pageNotes.length > 0 && (
                        <span className="ml-1 text-[10px] text-[#6cf4e0]">{pageNotes.length}</span>
                      )}
                      {tab === "highlights" && pageHighlights.length > 0 && (
                        <span className="ml-1 text-[10px] text-[#6cf4e0]">{pageHighlights.length}</span>
                      )}
                      {tab === "bookmarks" && bookmarks.length > 0 && (
                        <span className="ml-1 text-[10px] text-[#6cf4e0]">{bookmarks.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPanel(false)}
                  className="flex size-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white/70"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-3">
                {/* ─ Notes tab ─ */}
                {panelTab === "notes" && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-white/50">
                      Page {currentPage} &middot; {pageNotes.length} note{pageNotes.length !== 1 ? "s" : ""}
                    </p>
                    {pageNotes.map((note) => (
                      <div key={note.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                        {note.selectedText && (
                          <p className="mb-1 line-clamp-2 border-l-2 border-[#26d9c0]/40 pl-2 text-[11px] italic leading-relaxed text-white/40">
                            &ldquo;{note.selectedText}&rdquo;
                          </p>
                        )}
                        <p className="leading-relaxed text-white/85">{note.text}</p>
                        <button
                          type="button"
                          onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
                          className="mt-1 text-[10px] text-red-400/70 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {!pageNotes.length && <p className="py-4 text-center text-xs text-white/30">No notes on this page.</p>}

                    {/* All notes (other pages) */}
                    {notes.filter((n) => n.page !== currentPage).length > 0 && (
                      <>
                        <div className="mt-3 border-t border-white/10 pt-2">
                          <p className="text-[11px] font-medium text-white/40">Other pages</p>
                        </div>
                        {notes
                          .filter((n) => n.page !== currentPage)
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 20)
                          .map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              onClick={() => setCurrentPage(note.page)}
                              className="w-full rounded-lg bg-white/[0.03] px-3 py-2 text-left text-xs text-white/60 hover:bg-white/5"
                            >
                              <span className="text-[10px] font-medium text-[#26d9c0]/50">Page {note.page}</span>
                              <p className="line-clamp-2 leading-relaxed">{note.text}</p>
                            </button>
                          ))}
                      </>
                    )}

                    {/* Quick note input */}
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Quick note for this page..."
                        rows={2}
                        className="w-full rounded-lg border border-white/10 bg-[#0a1110] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#26d9c0]/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={!noteText.trim()}
                        className="mt-1.5 w-full rounded-lg border border-[#26d9c0]/50 bg-[#26d9c0]/10 py-1.5 text-xs font-medium text-[#78ffea] transition enabled:active:bg-[#26d9c0]/20 disabled:opacity-40"
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                )}

                {/* ─ Highlights tab ─ */}
                {panelTab === "highlights" && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-white/50">
                      Page {currentPage} &middot; {pageHighlights.length} highlight{pageHighlights.length !== 1 ? "s" : ""}
                    </p>
                    {pageHighlights.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{
                          backgroundColor:
                            item.color === "yellow" ? "rgba(254,240,138,0.12)"
                            : item.color === "green" ? "rgba(187,247,208,0.12)"
                            : item.color === "blue" ? "rgba(191,219,254,0.12)"
                            : "rgba(251,207,232,0.12)",
                          borderLeft: `3px solid ${
                            item.color === "yellow" ? "#fef08a"
                            : item.color === "green" ? "#86efac"
                            : item.color === "blue" ? "#93c5fd"
                            : "#f9a8d4"
                          }`,
                        }}
                      >
                        <p className="leading-relaxed text-white/80">{item.text}</p>
                        <button
                          type="button"
                          onClick={() => setHighlights((prev) => prev.filter((h) => h.id !== item.id))}
                          className="mt-1 text-[10px] text-red-400/70 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {!pageHighlights.length && <p className="py-4 text-center text-xs text-white/30">No highlights on this page.</p>}

                    {/* All highlights (other pages) */}
                    {highlights.filter((h) => h.page !== currentPage).length > 0 && (
                      <>
                        <div className="mt-3 border-t border-white/10 pt-2">
                          <p className="text-[11px] font-medium text-white/40">Other pages</p>
                        </div>
                        {highlights
                          .filter((h) => h.page !== currentPage)
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 20)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setCurrentPage(item.page)}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs text-white/60 hover:bg-white/5"
                              style={{
                                backgroundColor:
                                  item.color === "yellow" ? "rgba(254,240,138,0.05)"
                                  : item.color === "green" ? "rgba(187,247,208,0.05)"
                                  : item.color === "blue" ? "rgba(191,219,254,0.05)"
                                  : "rgba(251,207,232,0.05)",
                              }}
                            >
                              <span className="text-[10px] font-medium text-[#26d9c0]/50">Page {item.page}</span>
                              <p className="line-clamp-2 leading-relaxed">{item.text}</p>
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                )}

                {/* ─ Bookmarks tab ─ */}
                {panelTab === "bookmarks" && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setBookmarks((prev) => [
                          { id: uid(), page: currentPage, label: `Page ${currentPage}` },
                          ...prev,
                        ])
                      }
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Bookmark page {currentPage}
                    </button>
                    {bookmarks.map((mark) => (
                      <div key={mark.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setCurrentPage(mark.page)}
                          className="min-w-0 flex-1 text-left text-white/80 hover:text-white"
                        >
                          {mark.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookmarks((prev) => prev.filter((b) => b.id !== mark.id))}
                          className="shrink-0 text-[10px] text-red-400/60 hover:text-red-300"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {!bookmarks.length && <p className="py-4 text-center text-xs text-white/30">No bookmarks yet.</p>}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Videos / Mocks (below reader) ── */}
      {subject && (filteredVideos.length > 0 || filteredMocks.length > 0) ? (
        <div className="shrink-0 border-t border-white/10 px-3 pb-4 pt-3 sm:px-6">
          <div className="mx-auto max-w-[1200px]">
            {/* Search for resources */}
            {(relatedVideos.length > 0 || relatedMocks.length > 0) && (
              <div className="mb-3">
                <input
                  value={workspaceQuery}
                  onChange={(e) => setWorkspaceQuery(e.target.value)}
                  placeholder="Search videos, audios, mocks..."
                  className="w-full max-w-xs rounded-lg border border-white/15 bg-[#0d1514] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30"
                />
              </div>
            )}

            {filteredVideos.length > 0 && selectedVideo ? (
              <section className="mb-4 rounded-xl border border-white/10 bg-[#0d1514] p-3 sm:p-4">
                <h2 className="mb-2 text-sm font-semibold text-white">Video Lessons</h2>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    <video
                      key={selectedVideo.id}
                      src={selectedVideo.fileUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-black"
                    />
                    <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="truncate text-sm font-medium text-white">{selectedVideo.title}</p>
                      {selectedVideo.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-white/55">{selectedVideo.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="max-h-[300px] space-y-1.5 overflow-auto rounded-lg border border-white/10 bg-[#0a1110] p-2">
                    {filteredVideos.map((video, index) => {
                      const isActive = video.id === selectedVideoId;
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => setSelectedVideoId(video.id)}
                          className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                            isActive
                              ? "border-[#26d9c0]/50 bg-[#26d9c0]/10"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="line-clamp-2 font-medium text-white">
                              {index + 1}. {video.title}
                            </p>
                            {video.durationSeconds ? (
                              <span className="shrink-0 text-[10px] text-white/50">{fmtTime(video.durationSeconds)}</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            {filteredMocks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredMocks.slice(0, 3).map((mock) => (
                  <Link
                    key={mock.id}
                    href={`/mocks/${mock.id}?mode=practice`}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    Practice: {mock.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Mobile floating panel toggle */}
      {!isDesktop && (
        <button
          type="button"
          onClick={() => setShowPanel((v) => !v)}
          title="Notes & highlights"
          className={`fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-12 items-center gap-2 rounded-full border px-3 shadow-lg backdrop-blur lg:hidden ${
            showPanel
              ? "border-[#26d9c0]/60 bg-[#26d9c0]/20 text-[#6cf4e0]"
              : "border-white/20 bg-[#0d1514]/90 text-white/80"
          }`}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-medium">Notes</span>
        </button>
      )}

      {/* ── Audio footer (unchanged) ── */}
      <footer
        className="sticky bottom-0 z-30 shrink-0 border-t border-white/10 bg-[#0f1716]/97 px-3 pt-2 backdrop-blur sm:px-6"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        {selectedAudio ? (
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3">
            <div ref={audioPickerRef} className="relative min-w-0 flex-1" data-audio-picker>
              <button
                type="button"
                onClick={() => setShowAudioPicker((v) => !v)}
                className="max-w-full truncate text-left text-sm font-medium text-white hover:text-[#7cfce9]"
                title="Change audio"
              >
                {selectedAudio.title}
              </button>
              <p className="text-xs text-white/55">
                {fmtTime(audioPosition)} / {fmtTime(audioDuration)}
              </p>
              {showAudioPicker && filteredAudios.length > 0 && (
                <div className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-[min(100%,360px)] overflow-y-auto rounded-lg border border-white/15 bg-[#0d1514] p-1 shadow-xl">
                  {filteredAudios.map((audio) => {
                    const active = audio.id === selectedAudioId;
                    return (
                      <button
                        key={audio.id}
                        type="button"
                        onClick={() => {
                          setSelectedAudioId(audio.id);
                          setShowAudioPicker(false);
                        }}
                        className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs transition ${
                          active
                            ? "bg-[#26d9c0]/20 text-[#7cfce9]"
                            : "text-white/75 hover:bg-white/10 hover:text-white"
                        }`}
                        title={audio.title}
                      >
                        {audio.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <audio
              ref={audioRef}
              src={selectedAudio.fileUrl}
              controls
              className="h-10 w-full min-w-0 md:max-w-[560px]"
              onLoadedMetadata={(event) => {
                setAudioDuration(event.currentTarget.duration || 0);
                event.currentTarget.currentTime = audioPosition || 0;
                event.currentTarget.playbackRate = audioRate;
              }}
              onTimeUpdate={(event) => setAudioPosition(event.currentTarget.currentTime || 0)}
            />
            <div className="flex gap-1">
              {[0.75, 1, 1.25, 1.5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAudioRate(value);
                    if (audioRef.current) audioRef.current.playbackRate = value;
                  }}
                  className={`rounded border px-2 py-1 text-xs ${
                    audioRate === value
                      ? "border-[#26d9c0]/60 bg-[#26d9c0]/20 text-[#7cfce9]"
                      : "border-white/15 bg-white/5 text-white/75"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[1200px] rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-1.5 text-center text-xs text-white/50">
            No audio lesson for this subject yet.
          </div>
        )}
      </footer>
      <StudentAssistant />
    </div>
  );
}
