"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import type { AudioStudyState, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";
import StudyPdfPane, { usePreferPdfJsViewer } from "@/app/components/student/study-pdf-pane";
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

function StudyBadge({ active, label, onClick }: { active: boolean; label: string; onClick?: () => void }) {
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-[#26d9c0]/50 bg-[#26d9c0]/15 text-[#6cf4e0]"
          : interactive
            ? "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
            : "cursor-default border-white/10 bg-white/[0.04] text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
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

  const [activePanel, setActivePanel] = useState<"audios" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Array<{ id: string; page: number; label: string }>>([]);
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [highlightText, setHighlightText] = useState("");
  const [highlightColor, setHighlightColor] = useState<PdfHighlight["color"]>("yellow");
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const preferPdfJsViewer = usePreferPdfJsViewer();
  const pdfBlobRef = useRef<string | null>(null);
  const lastLoadedBookRef = useRef<string | null>(null);
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  const highlightsSectionRef = useRef<HTMLDivElement | null>(null);

  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(relatedAudios[0]?.id ?? null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioRate, setAudioRate] = useState(1);
  const [audioReady, setAudioReady] = useState(false);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedAudioId((prev) => (prev && relatedAudios.some((a) => a.id === prev) ? prev : relatedAudios[0]?.id ?? null));
  }, [relatedAudios]);

  useEffect(() => {
    setSelectedVideoId((prev) =>
      prev && relatedVideos.some((video) => video.id === prev) ? prev : relatedVideos[0]?.id ?? null,
    );
  }, [relatedVideos]);

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
    if (!preferPdfJsViewer) setPdfNumPages(null);
  }, [preferPdfJsViewer]);

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

  const selectedAudio = useMemo(
    () => relatedAudios.find((audio) => audio.id === selectedAudioId) ?? null,
    [relatedAudios, selectedAudioId],
  );
  const selectedVideo = useMemo(
    () => relatedVideos.find((video) => video.id === selectedVideoId) ?? null,
    [relatedVideos, selectedVideoId],
  );
  const pageHighlights = highlights.filter((item) => item.page === currentPage);
  const pageNotes = notes.filter((item) => item.page === currentPage);
  const recentHighlights = useMemo(
    () =>
      [...highlights]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [highlights],
  );
  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [notes],
  );
  const pageNotesPreview = useMemo(() => pageNotes.slice(0, 4), [pageNotes]);
  const pageHighlightsPreview = useMemo(() => pageHighlights.slice(0, 4), [pageHighlights]);
  const bookmarksPreview = useMemo(() => bookmarks.slice(0, 8), [bookmarks]);
  const pdfUrl = relatedBookId ? pdfBlobUrl : null;
  const iframePdfUrl = useMemo(() => {
    if (!pdfUrl) return null;
    // Ask built-in PDF viewers to hide side panels for a cleaner reading mode.
    return `${pdfUrl}#navpanes=0&toolbar=1&statusbar=0&messages=0`;
  }, [pdfUrl]);
  const backTrackHref = subject?.track === "FLK 2" ? "/subjects/flk2" : "/subjects/flk1";
  const noteCountLabel = pageNotes.length ? `${pageNotes.length} on this page` : "No notes on this page";
  const highlightCountLabel = pageHighlights.length
    ? `${pageHighlights.length} on this page`
    : "No highlights on this page";

  const scrollToSection = (section: "notes" | "highlights") => {
    const target = section === "notes" ? notesSectionRef.current : highlightsSectionRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
  };

  return (
    <div className="min-h-screen bg-[#0f1716] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1716]/95 backdrop-blur">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <Link
                  href={backTrackHref}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white/80 hover:bg-white/10"
                >
                  <span aria-hidden>←</span>
                  <span>Back</span>
                </Link>
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <Link href={backTrackHref} className="hover:text-[#26d9c0]">
                    {subject?.track || "FLK"}
                  </Link>
                  <span>/</span>
                  <span>Study</span>
                </div>
              </div>
              <h1 className="truncate font-[family-name:var(--font-playfair)] text-xl font-semibold sm:text-2xl">
                {subject?.name || "Subject Study Workspace"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <StudyBadge
                active={false}
                label={highlightCountLabel}
                onClick={() => scrollToSection("highlights")}
              />
              <StudyBadge
                active={false}
                label={noteCountLabel}
                onClick={() => scrollToSection("notes")}
              />
              <StudyBadge
                active={activePanel === "audios"}
                label={`Audios (${relatedAudios.length})`}
                onClick={() => setActivePanel((prev) => (prev === "audios" ? null : "audios"))}
              />
            </div>
          </div>
          {pdfMessage ? <p className="mt-2 text-xs text-amber-300">{pdfMessage}</p> : null}
          {audioMessage ? <p className="mt-1 text-xs text-amber-300">{audioMessage}</p> : null}
        </div>
      </header>

      {activePanel ? (
        <section className="sticky top-[76px] z-30 border-b border-white/10 bg-[#101b1a]/95 px-4 py-3 backdrop-blur sm:px-6">
          {activePanel === "audios" ? (
            <div className="flex flex-wrap items-center gap-2">
              {!relatedAudios.length ? (
                <p className="text-sm text-white/70">No audio lessons published for this subject yet.</p>
              ) : (
                relatedAudios.map((audio) => (
                  <button
                    key={audio.id}
                    type="button"
                    onClick={() => setSelectedAudioId(audio.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      selectedAudioId === audio.id
                        ? "border-[#26d9c0]/60 bg-[#26d9c0]/15 text-[#6cf4e0]"
                        : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                    }`}
                  >
                    {audio.title}
                  </button>
                ))
              )}
            </div>
          ) : null}

        </section>
      ) : null}

      <main className="px-3 pb-36 pt-4 sm:px-6">
        {!loading && !subject ? (
          <section className="mx-auto max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
            Subject not found or not published.
          </section>
        ) : null}

        {subject ? (
          <section className="mx-auto max-w-[1400px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <p className="min-w-0 truncate">
                  {relatedBook?.title || "No PDF book is currently available for this subject."}
                </p>
                {booksForSubject.length > 1 ? (
                  <label className="flex shrink-0 items-center gap-2 text-white/70">
                    <span className="text-white/45">PDF</span>
                    <select
                      value={selectedBookId}
                      onChange={(event) => setSelectedBookId(event.target.value)}
                      className="max-w-[220px] truncate rounded-lg border border-white/20 bg-[#0d1514] px-2 py-1.5 text-xs text-white sm:max-w-xs"
                    >
                      {booksForSubject.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {relatedBook ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="rounded border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
                  >
                    Prev
                  </button>
                  <span>{currentPage}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) =>
                        preferPdfJsViewer && pdfNumPages != null
                          ? Math.min(prev + 1, pdfNumPages)
                          : prev + 1,
                      )
                    }
                    className="rounded border border-white/15 px-2 py-1 text-white/80 hover:bg-white/10"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#111a19] to-[#0b1110] p-3 sm:p-8">
              {relatedBook && pdfUrl ? (
                <div className="mx-auto max-w-[900px]">
                  <div className="flex h-[72vh] min-h-[360px] w-full flex-col overflow-hidden sm:h-[82vh] sm:min-h-[680px]">
                    {iframePdfUrl ? (
                      <StudyPdfPane
                        bookId={relatedBookId}
                        pdfBlobUrl={pdfUrl}
                        iframePdfUrl={iframePdfUrl}
                        title={relatedBook?.title || "Study Book PDF"}
                        currentPage={currentPage}
                        onNumPages={setPdfNumPages}
                      />
                    ) : null}
                  </div>
                  <div className="mx-auto mt-3 w-fit rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    Page {currentPage}
                  </div>
                </div>
              ) : relatedBook ? (
                <div className="mx-auto max-w-2xl rounded-xl border border-white/20 bg-white/5 p-8 text-center text-sm text-white/75">
                  <p>{pdfLoading ? "Loading PDF..." : pdfLoadError || "Preparing your PDF..."}</p>
                  <button
                    type="button"
                    onClick={() => setPdfReloadKey((prev) => prev + 1)}
                    className="mt-3 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 hover:bg-white/15"
                  >
                    Retry PDF load
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-white/75">
                  PDF is not available for this subject yet. Ask admin to upload and publish the book.
                </div>
              )}
            </div>

            <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d1514] p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-white sm:text-xl">
                    Quick Capture
                  </h2>
                  <p className="text-xs text-white/60">
                    Capture a thought once, save it as note or highlight in one tap.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                  Page {currentPage}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <label className="text-xs text-white/65" htmlFor="note-input">
                    Note
                  </label>
                  <textarea
                    id="note-input"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Type a quick note from this page..."
                    className="mt-1 min-h-24 w-full rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2 text-sm text-white placeholder:text-white/35"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addNote}
                      className="rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea]"
                    >
                      Save as note
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteText("")}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBookmarks((prev) => [{ id: uid(), page: currentPage, label: `Page ${currentPage}` }, ...prev])
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                    >
                      Bookmark page
                    </button>
                  </div>

                  <div ref={highlightsSectionRef} className="mt-4 scroll-mt-28">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-white/65" htmlFor="highlight-input">
                        Highlight
                      </label>
                      <select
                        value={highlightColor}
                        onChange={(event) => setHighlightColor(event.target.value as PdfHighlight["color"])}
                        className="rounded-lg border border-white/10 bg-[#0f1716] px-2 py-1.5 text-xs text-white"
                      >
                        <option value="yellow">Yellow</option>
                        <option value="green">Green</option>
                        <option value="blue">Blue</option>
                        <option value="pink">Pink</option>
                      </select>
                    </div>
                    <input
                      id="highlight-input"
                      value={highlightText}
                      onChange={(event) => setHighlightText(event.target.value)}
                      placeholder="Paste important passage..."
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2 text-sm text-white placeholder:text-white/35"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={addHighlight}
                        className="rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea]"
                      >
                        Save as highlight
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighlightText("")}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div ref={notesSectionRef} className="scroll-mt-28 rounded-xl border border-white/10 bg-[#0a1110] p-3">
                    <p className="text-xs font-medium text-white/70">Notes on this page</p>
                    <div className="mt-2 space-y-2">
                      {pageNotesPreview.map((note) => (
                        <div key={note.id} className="rounded-md bg-white/5 px-2 py-1.5 text-sm">
                          <p>{note.text}</p>
                          <button
                            type="button"
                            onClick={() => setNotes((prev) => prev.filter((item) => item.id !== note.id))}
                            className="mt-1 text-xs text-white/60 underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {!pageNotes.length ? <p className="text-xs text-white/45">No notes yet.</p> : null}
                      {pageNotes.length > pageNotesPreview.length ? (
                        <p className="text-xs text-white/45">Showing latest {pageNotesPreview.length} notes on this page.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                    <p className="text-xs font-medium text-white/70">Highlights on this page</p>
                    <div className="mt-2 space-y-2">
                      {pageHighlightsPreview.map((item) => (
                        <div key={item.id} className="rounded-md bg-white/5 px-2 py-1.5 text-sm">
                          <p>{item.text}</p>
                          <button
                            type="button"
                            onClick={() => setHighlights((prev) => prev.filter((h) => h.id !== item.id))}
                            className="mt-1 text-xs text-white/60 underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {!pageHighlights.length ? <p className="text-xs text-white/45">No highlights yet.</p> : null}
                      {pageHighlights.length > pageHighlightsPreview.length ? (
                        <p className="text-xs text-white/45">
                          Showing latest {pageHighlightsPreview.length} highlights on this page.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <p className="text-xs font-medium text-white/70">Recent notes</p>
                  <div className="mt-2 space-y-2">
                    {recentNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setCurrentPage(note.page)}
                        className="w-full rounded-md bg-white/5 px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"
                      >
                        <span className="block text-[10px] text-white/50">Page {note.page}</span>
                        <span className="line-clamp-2">{note.text}</span>
                      </button>
                    ))}
                    {!recentNotes.length ? <p className="text-xs text-white/45">No saved notes yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <p className="text-xs font-medium text-white/70">Recent highlights</p>
                  <div className="mt-2 space-y-2">
                    {recentHighlights.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentPage(item.page)}
                        className="w-full rounded-md bg-white/5 px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"
                      >
                        <span className="block text-[10px] text-white/50">Page {item.page}</span>
                        <span className="line-clamp-2">{item.text}</span>
                      </button>
                    ))}
                    {!recentHighlights.length ? <p className="text-xs text-white/45">No saved highlights yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <p className="text-xs font-medium text-white/70">Bookmarks</p>
                  <div className="mt-2 space-y-1">
                    {bookmarksPreview.map((mark) => (
                      <button
                        type="button"
                        key={mark.id}
                        onClick={() => setCurrentPage(mark.page)}
                        className="block w-full rounded-md px-2 py-1 text-left text-xs text-white/80 hover:bg-white/10"
                      >
                        {mark.label}
                      </button>
                    ))}
                    {!bookmarks.length ? <p className="text-xs text-white/45">No bookmarks yet.</p> : null}
                    {bookmarks.length > bookmarksPreview.length ? (
                      <p className="text-xs text-white/45">Showing latest {bookmarksPreview.length} bookmarks.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d1514] p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-white sm:text-xl">
                    Video Lessons
                  </h2>
                  <p className="text-xs text-white/60">
                    Watch topic walkthroughs while you study this subject.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                  {relatedVideos.length} lesson{relatedVideos.length === 1 ? "" : "s"}
                </span>
              </div>

              {selectedVideo ? (
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <video
                      key={selectedVideo.id}
                      src={selectedVideo.fileUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-black"
                    />
                    <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-white">{selectedVideo.title}</p>
                      {selectedVideo.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/65">{selectedVideo.description}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="max-h-[420px] space-y-2 overflow-auto rounded-xl border border-white/10 bg-[#0a1110] p-2">
                    {relatedVideos.map((video, index) => {
                      const isActive = video.id === selectedVideoId;
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => setSelectedVideoId(video.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            isActive
                              ? "border-[#26d9c0]/60 bg-[#26d9c0]/15"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-medium text-white">
                              {index + 1}. {video.title}
                            </p>
                            {video.durationSeconds ? (
                              <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-[11px] text-white/75">
                                {fmtTime(video.durationSeconds)}
                              </span>
                            ) : null}
                          </div>
                          {video.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-white/60">{video.description}</p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/70">
                  No published videos for this subject yet.
                </div>
              )}
            </section>

            {relatedMocks.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedMocks.slice(0, 3).map((mock) => (
                  <Link
                    key={mock.id}
                    href={`/mocks/${mock.id}?mode=practice`}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
                  >
                    Practice mock: {mock.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0f1716]/97 px-3 py-2 backdrop-blur sm:px-6">
        {selectedAudio ? (
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{selectedAudio.title}</p>
              <p className="text-xs text-white/55">
                {fmtTime(audioPosition)} / {fmtTime(audioDuration)}
              </p>
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
          <div className="mx-auto max-w-[1400px] rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70">
            No published audio lesson for this subject yet.
          </div>
        )}
      </footer>
    </div>
  );
}
