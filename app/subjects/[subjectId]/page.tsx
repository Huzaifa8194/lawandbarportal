"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import type { AudioStudyState, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";
import StudyPdfPane, { usePreferPdfJsViewer } from "@/app/components/student/study-pdf-pane";
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

function StudyBadge({
  active,
  label,
  icon,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      title={label}
      className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm font-medium transition sm:px-3 ${
        active
          ? "border-[#26d9c0]/50 bg-[#26d9c0]/15 text-[#6cf4e0]"
          : interactive
            ? "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
            : "cursor-default border-white/10 bg-white/[0.04] text-white/70"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count != null && count > 0 && (
        <span className="flex size-4 items-center justify-center rounded-full bg-[#26d9c0]/25 text-[10px] font-bold text-[#6cf4e0] sm:size-5 sm:text-xs">
          {count}
        </span>
      )}
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
    setSelectedAudioId((prev) =>
      prev && filteredAudios.some((audio) => audio.id === prev) ? prev : filteredAudios[0]?.id ?? null,
    );
  }, [filteredAudios]);

  useEffect(() => {
    setSelectedVideoId((prev) =>
      prev && filteredVideos.some((video) => video.id === prev) ? prev : filteredVideos[0]?.id ?? null,
    );
  }, [filteredVideos]);

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
    () => filteredAudios.find((audio) => audio.id === selectedAudioId) ?? null,
    [filteredAudios, selectedAudioId],
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
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1716]/95 backdrop-blur"
        style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }}
      >
        <div className="px-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <Link
                  href={backTrackHref}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white/80 hover:bg-white/10"
                  aria-label="Back"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Back</span>
                </Link>
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <Link href={backTrackHref} className="hover:text-[#26d9c0]">
                    {subject?.track || "FLK"}
                  </Link>
                  <span>/</span>
                  <span>Study</span>
                </div>
              </div>
              <h1 className="truncate font-[family-name:var(--font-playfair)] text-lg font-semibold sm:text-2xl">
                {subject?.name || "Subject Study Workspace"}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <StudyBadge
                active={false}
                label={highlightCountLabel}
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                }
                count={pageHighlights.length}
                onClick={() => scrollToSection("highlights")}
              />
              <StudyBadge
                active={false}
                label={noteCountLabel}
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
                count={pageNotes.length}
                onClick={() => scrollToSection("notes")}
              />
              <StudyBadge
                active={activePanel === "audios"}
                label={`Audios (${filteredAudios.length})`}
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4-4m4 4l4-4M9.172 9.172a4 4 0 015.656 0" />
                  </svg>
                }
                count={filteredAudios.length}
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
              {!filteredAudios.length ? (
                <p className="text-sm text-white/70">No audio lessons published for this subject yet.</p>
              ) : (
                filteredAudios.map((audio) => (
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
                <label className="min-w-0 flex-shrink sm:min-w-[220px] sm:shrink-0 text-white/75">
                  <span className="mb-1 block text-[11px] text-white/55">Search workspace</span>
                  <input
                    value={workspaceQuery}
                    onChange={(event) => setWorkspaceQuery(event.target.value)}
                    placeholder="Search videos, audios, mocks..."
                    className="w-full rounded-lg border border-white/20 bg-[#0d1514] px-2 py-1.5 text-xs text-white placeholder:text-white/35"
                  />
                </label>
              {relatedBook ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    aria-label="Previous page"
                    className="min-h-[32px] min-w-[32px] rounded border border-white/15 px-1.5 py-1 text-white/80 active:bg-white/10 sm:px-2"
                  >
                    <svg className="mx-auto size-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="hidden sm:inline text-xs">Prev</span>
                  </button>
                  <span className="text-xs tabular-nums">{currentPage}{pdfNumPages ? `/${pdfNumPages}` : ""}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) =>
                        preferPdfJsViewer && pdfNumPages != null
                          ? Math.min(prev + 1, pdfNumPages)
                          : prev + 1,
                      )
                    }
                    aria-label="Next page"
                    className="min-h-[32px] min-w-[32px] rounded border border-white/15 px-1.5 py-1 text-white/80 active:bg-white/10 sm:px-2"
                  >
                    <svg className="mx-auto size-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="hidden sm:inline text-xs">Next</span>
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

            <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d1514] p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-playfair)] text-base font-semibold text-white sm:text-xl">
                    Quick Capture
                  </h2>
                  <p className="text-[11px] text-white/50 sm:text-xs sm:text-white/60">
                    Save notes &amp; highlights in one tap.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                  Page {currentPage}
                </span>
              </div>

              {/* Quick actions row — bookmark + color picker always visible */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBookmarks((prev) => [{ id: uid(), page: currentPage, label: `Page ${currentPage}` }, ...prev])
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 active:bg-white/10"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span className="hidden sm:inline">Bookmark page</span>
                </button>
                <div className="flex items-center gap-1">
                  {(["yellow", "green", "blue", "pink"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHighlightColor(c)}
                      aria-label={`${c} highlight`}
                      className={`size-7 rounded-full border-2 transition sm:size-8 ${
                        highlightColor === c ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor:
                          c === "yellow" ? "#fef08a" : c === "green" ? "#bbf7d0" : c === "blue" ? "#bfdbfe" : "#fbcfe8",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                {/* Note input */}
                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <label className="text-xs font-medium text-white/65" htmlFor="note-input">
                    Note
                  </label>
                  <textarea
                    id="note-input"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Type a quick note from this page..."
                    rows={3}
                    className="mt-1 min-h-[72px] w-full rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2.5 text-sm text-white placeholder:text-white/35 sm:min-h-24"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={addNote}
                      className="min-h-[40px] flex-1 rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea] active:bg-[#26d9c0]/25"
                    >
                      Save note
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteText("")}
                      className="min-h-[40px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Highlight input */}
                  <div ref={highlightsSectionRef} className="mt-4 scroll-mt-28 border-t border-white/10 pt-3">
                    <label className="text-xs font-medium text-white/65" htmlFor="highlight-input">
                      Highlight
                    </label>
                    <input
                      id="highlight-input"
                      value={highlightText}
                      onChange={(event) => setHighlightText(event.target.value)}
                      placeholder="Paste important passage..."
                      className="mt-1 min-h-[40px] w-full rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2.5 text-sm text-white placeholder:text-white/35"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={addHighlight}
                        className="min-h-[40px] flex-1 rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea] active:bg-[#26d9c0]/25"
                      >
                        Save highlight
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighlightText("")}
                        className="min-h-[40px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes + highlights on this page */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
                  <div ref={notesSectionRef} className="scroll-mt-28 rounded-xl border border-white/10 bg-[#0a1110] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/70">Notes on this page</p>
                      {pageNotes.length > 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
                          {pageNotes.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {pageNotesPreview.map((note) => (
                        <div key={note.id} className="group rounded-lg bg-white/5 px-3 py-2 text-sm">
                          <p className="leading-relaxed">{note.text}</p>
                          <button
                            type="button"
                            onClick={() => setNotes((prev) => prev.filter((item) => item.id !== note.id))}
                            className="mt-1.5 min-h-[28px] rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-300 active:bg-red-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {!pageNotes.length ? <p className="text-xs text-white/45">No notes yet.</p> : null}
                      {pageNotes.length > pageNotesPreview.length ? (
                        <p className="text-xs text-white/45">Showing latest {pageNotesPreview.length} notes.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white/70">Highlights on this page</p>
                      {pageHighlights.length > 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
                          {pageHighlights.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {pageHighlightsPreview.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            backgroundColor:
                              item.color === "yellow" ? "rgba(254,240,138,0.15)"
                              : item.color === "green" ? "rgba(187,247,208,0.15)"
                              : item.color === "blue" ? "rgba(191,219,254,0.15)"
                              : "rgba(251,207,232,0.15)",
                            borderLeft: `3px solid ${
                              item.color === "yellow" ? "#fef08a"
                              : item.color === "green" ? "#86efac"
                              : item.color === "blue" ? "#93c5fd"
                              : "#f9a8d4"
                            }`,
                          }}
                        >
                          <p className="leading-relaxed">{item.text}</p>
                          <button
                            type="button"
                            onClick={() => setHighlights((prev) => prev.filter((h) => h.id !== item.id))}
                            className="mt-1.5 min-h-[28px] rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-300 active:bg-red-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {!pageHighlights.length ? <p className="text-xs text-white/45">No highlights yet.</p> : null}
                      {pageHighlights.length > pageHighlightsPreview.length ? (
                        <p className="text-xs text-white/45">
                          Showing latest {pageHighlightsPreview.length} highlights.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <div className="flex items-center gap-2">
                    <svg className="size-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <p className="text-xs font-medium text-white/70">Recent notes</p>
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {recentNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => setCurrentPage(note.page)}
                        className="w-full min-h-[36px] rounded-lg bg-white/5 px-2.5 py-2 text-left text-xs text-white/80 active:bg-white/10"
                      >
                        <span className="block text-[10px] font-medium text-[#26d9c0]/60">Page {note.page}</span>
                        <span className="line-clamp-2 leading-relaxed">{note.text}</span>
                      </button>
                    ))}
                    {!recentNotes.length ? <p className="text-xs text-white/45">No saved notes yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <div className="flex items-center gap-2">
                    <svg className="size-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <p className="text-xs font-medium text-white/70">Recent highlights</p>
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {recentHighlights.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentPage(item.page)}
                        className="w-full min-h-[36px] rounded-lg px-2.5 py-2 text-left text-xs text-white/80 active:bg-white/10"
                        style={{
                          backgroundColor:
                            item.color === "yellow" ? "rgba(254,240,138,0.08)"
                            : item.color === "green" ? "rgba(187,247,208,0.08)"
                            : item.color === "blue" ? "rgba(191,219,254,0.08)"
                            : "rgba(251,207,232,0.08)",
                        }}
                      >
                        <span className="block text-[10px] font-medium text-[#26d9c0]/60">Page {item.page}</span>
                        <span className="line-clamp-2 leading-relaxed">{item.text}</span>
                      </button>
                    ))}
                    {!recentHighlights.length ? <p className="text-xs text-white/45">No saved highlights yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  <div className="flex items-center gap-2">
                    <svg className="size-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <p className="text-xs font-medium text-white/70">Bookmarks</p>
                  </div>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {bookmarksPreview.map((mark) => (
                      <button
                        type="button"
                        key={mark.id}
                        onClick={() => setCurrentPage(mark.page)}
                        className="block w-full min-h-[32px] rounded-lg bg-white/5 px-2.5 py-1.5 text-left text-xs text-white/80 active:bg-white/10"
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

            {filteredVideos.length > 0 ? (
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
                    {filteredVideos.length} lesson{filteredVideos.length === 1 ? "" : "s"}
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
                      {filteredVideos.map((video, index) => {
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
                ) : null}
              </section>
            ) : null}

            {filteredMocks.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {filteredMocks.slice(0, 3).map((mock) => (
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

      <footer
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0f1716]/97 px-3 pt-2 backdrop-blur sm:px-6"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
      >
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
      <StudentAssistant />
    </div>
  );
}
