"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { studentApi } from "@/lib/services/student-api";
import { audiosForSubjectSorted } from "@/lib/sort-audios";
import type { AudioStudyState, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";
import StudyPdfPane from "@/app/components/student/study-pdf-pane";
import PdfFeedback from "@/app/components/student/pdf-feedback";
import { viewerStudyItems } from "@/lib/pdf-annotations";
import { downloadBookPdf } from "@/lib/services/pdf-download";
import { describePdfError, type PdfLoadError } from "@/lib/pdf-errors";
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
  const audioOnlyMode = pathname.startsWith("/audios/");
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
  const relatedAudios = useMemo(
    () => audiosForSubjectSorted(audios, params.subjectId),
    [audios, params.subjectId],
  );
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
  const studyKey = user && relatedBookId ? JSON.stringify([user.uid, relatedBookId]) : null;
  const [loadedStudyKey, setLoadedStudyKey] = useState<string | null>(null);
  const pdfReady = studyKey !== null && loadedStudyKey === studyKey;
  const readingStarted = useRef(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<{ key: string; url: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<PdfLoadError | null>(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  const [pdfProgress, setPdfProgress] = useState("Checking book access…");
  const [viewerAnnotationsJson, setViewerAnnotationsJson] = useState("");
  const [studyReloadKey, setStudyReloadKey] = useState(0);
  const [saveRetryKey, setSaveRetryKey] = useState(0);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const pdfBlobRef = useRef<string | null>(null);

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
  const [panelTab, setPanelTab] = useState<PanelTab>("notes");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      const desktop = media.matches;
      setShowPanel(desktop);
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
      if (!studyKey) {
        setPdfLoading(false);
        setPdfLoadError(null);
        if (pdfBlobRef.current) {
          URL.revokeObjectURL(pdfBlobRef.current);
          pdfBlobRef.current = null;
        }
        setPdfFile(null);
        return;
      }
      if (!user) return;
      if (pdfBlobRef.current) {
        URL.revokeObjectURL(pdfBlobRef.current);
        pdfBlobRef.current = null;
        setPdfFile(null);
      }

      setPdfLoading(true);
      setPdfLoadError(null);
      try {
        const blob = await downloadBookPdf(relatedBookId, (refresh) => user.getIdToken(refresh), controller.signal, (progress) => {
          if (cancelled) return;
          if (progress.stage === "source") setPdfProgress("Finding your book…");
          else {
            const mb = ((progress.received || 0) / 1024 / 1024).toFixed(1);
            const total = progress.total ? ` of ${(progress.total / 1024 / 1024).toFixed(1)} MB` : " MB";
            setPdfProgress(`Downloading PDF: ${mb}${total}`);
          }
        });
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (pdfBlobRef.current) URL.revokeObjectURL(pdfBlobRef.current);
        pdfBlobRef.current = nextUrl;
        setPdfFile({ key: studyKey, url: nextUrl });
      } catch (error) {
        if (!cancelled) setPdfLoadError(describePdfError(error));
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    void loadPdfBlob();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [relatedBookId, studyKey, user, pdfReloadKey]);

  useEffect(() => {
    setPdfNumPages(null);
    setCurrentPage(1);
    readingStarted.current = false;
  }, [studyKey]);

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
    if (!studyKey) {
      setLoadedStudyKey(null);
      setViewerAnnotationsJson("");
      setCurrentPage(1);
      setBookmarks([]);
      setNotes([]);
      setHighlights([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadedStudyKey(null);
      setPdfMessage(null);
      try {
        const saved = (await studentApi.getPdfState(relatedBookId)) as PdfStudyState | null;
        if (cancelled) return;
        if (saved) {
          setViewerAnnotationsJson(saved.viewerAnnotationsJson || "");
          if (!readingStarted.current) setCurrentPage(saved.currentPage || 1);
          setBookmarks(Array.isArray(saved.bookmarks) ? saved.bookmarks : []);
          setNotes(Array.isArray(saved.notes) ? saved.notes : []);
          setHighlights(Array.isArray(saved.highlights) ? saved.highlights : []);
        } else {
          setViewerAnnotationsJson("");
          if (!readingStarted.current) setCurrentPage(1);
          setBookmarks([]);
          setNotes([]);
          setHighlights([]);
        }
        setPdfMessage(null);
        setLoadedStudyKey(studyKey);
      } catch {
        if (!cancelled) setPdfMessage("Your saved study tools are temporarily unavailable. You can still read the book.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [relatedBookId, studyKey, studyReloadKey]);

  useEffect(() => {
    if (!relatedBookId || !pdfReady) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      studentApi
        .savePdfState(relatedBookId, {
          bookId: relatedBookId,
          currentPage,
          bookmarks,
          notes,
          highlights,
          viewerAnnotationsJson,
          updatedAt: new Date().toISOString(),
        })
        .then(() => { if (!cancelled) setPdfMessage(null); })
        .catch(() => { if (!cancelled) setPdfMessage("Study changes haven’t been saved. Keep this tab open and retry."); });
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [relatedBookId, studyKey, pdfReady, currentPage, bookmarks, notes, highlights, viewerAnnotationsJson, saveRetryKey]);

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
  const nativeStudyItems = useMemo(() => viewerStudyItems(viewerAnnotationsJson), [viewerAnnotationsJson]);
  const allHighlights = [...highlights, ...nativeStudyItems.highlights];
  const allNotes = [...notes, ...nativeStudyItems.notes];
  const removeStudyItem = (id: string, kind: "note" | "highlight") => {
    if (id.startsWith("viewer:")) {
      setViewerAnnotationsJson((json) => JSON.stringify((JSON.parse(json || "[]") as Array<{annotation: {id: string}}>).filter((item) => item.annotation.id !== id.slice(7))));
    } else if (kind === "note") setNotes((prev) => prev.filter((note) => note.id !== id));
    else setHighlights((prev) => prev.filter((highlight) => highlight.id !== id));
  };
  const pageHighlights = allHighlights.filter((item) => item.page === currentPage);
  const pageNotes = allNotes.filter((item) => item.page === currentPage);
  const pdfUrl = pdfFile?.key === studyKey ? pdfFile.url : null;
  const trackRoot = pathname.startsWith("/books/")
    ? "/books"
    : pathname.startsWith("/audios/")
      ? "/audios"
      : "/subjects";
  const backTrackHref = subject?.track === "FLK 2" ? `${trackRoot}/flk2` : `${trackRoot}/flk1`;

  const addBookmarkForCurrentPage = () => {
    setBookmarks((prev) => {
      const exists = prev.some((mark) => mark.page === currentPage);
      if (exists) return prev;
      return [{ id: uid(), page: currentPage, label: `Page ${currentPage}` }, ...prev];
    });
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
    <div className="min-h-screen bg-[#0f1716] text-white">
      <div className={audioOnlyMode ? "flex min-h-dvh flex-col" : "flex h-dvh min-h-72 flex-col"}>
      {/* ── Compact header (single row) ── */}
      <header
        className="z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#101b19] px-3 sm:px-5"
        style={{ paddingTop: "calc(8px + env(safe-area-inset-top, 0px))", paddingBottom: 10 }}
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
            {audioOnlyMode
              ? `${subject?.track || "FLK"} · Audio only`
              : `${subject?.track || "FLK"} · ${relatedBook?.title || "No book"}`}
          </p>
        </div>

        {/* Book switcher (when multiple books) */}
        {subject && <Link href={`/flashcards?subject=${encodeURIComponent(subject.id)}`} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10">Q&A cards</Link>}
        {!audioOnlyMode && booksForSubject.length > 1 && (
          <select
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            aria-label="Choose study book"
            className="order-last w-full sm:order-none sm:w-auto sm:max-w-[180px] truncate rounded-lg border border-white/15 bg-[#0d1514] px-2 py-1 text-xs text-white sm:block"
          >
            {booksForSubject.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        )}

        {!audioOnlyMode && relatedBook && (
          <button
            type="button"
            onClick={() => setShowPanel((open) => !open)}
            disabled={!pdfReady}
            aria-expanded={showPanel && pdfReady}
            aria-controls="study-panel"
            className="min-h-10 shrink-0 rounded-lg border border-[#86cfc1]/30 bg-[#86cfc1]/10 px-3 text-xs font-semibold text-[#b9eee2] hover:bg-[#86cfc1]/20 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#86cfc1]"
          >
            Study tools
          </button>
        )}
      </header>

      {!audioOnlyMode && pdfMessage ? <p className="shrink-0 bg-amber-900/30 px-4 py-1.5 text-xs text-amber-300">{pdfMessage} <button type="button" className="ml-2 underline" onClick={() => pdfReady ? setSaveRetryKey((prev) => prev + 1) : setStudyReloadKey((prev) => prev + 1)}>Retry notes</button></p> : null}
      {audioMessage ? <p className="shrink-0 bg-amber-900/30 px-4 py-1 text-xs text-amber-300">{audioMessage}</p> : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* PDF column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {audioOnlyMode ? (
            <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
              <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-white/5 p-5">
                <h2 className="text-xl font-semibold text-white">Audio Learning</h2>
                <p className="mt-1 text-sm text-white/60">
                  Select an audio from the player bar to start listening.
                </p>
                <div className="mt-4 max-h-[320px] space-y-2 overflow-auto rounded-xl border border-white/10 bg-[#0a1110] p-3">
                  {filteredAudios.map((audio, index) => {
                    const active = audio.id === selectedAudioId;
                    return (
                      <button
                        key={audio.id}
                        type="button"
                        onClick={() => setSelectedAudioId(audio.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          active
                            ? "border-[#26d9c0]/50 bg-[#26d9c0]/10 text-[#7cfce9]"
                            : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/8"
                        }`}
                      >
                        {index + 1}. {audio.title}
                      </button>
                    );
                  })}
                  {filteredAudios.length === 0 ? (
                    <p className="rounded-md border border-dashed border-white/15 px-3 py-6 text-center text-sm text-white/45">
                      No audio lessons for this subject yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : subject && relatedBook && pdfUrl ? (
            <StudyPdfPane
              key={pdfReady ? "study-ready" : "read-only"}
              studyReadOnly={!pdfReady}
              bookId={relatedBookId}
              pdfBlobUrl={pdfUrl}
              title={relatedBook?.title || "Study Book PDF"}
              currentPage={currentPage}
              totalPages={pdfNumPages}
              onPageChange={(page) => {
                if (page !== currentPage) readingStarted.current = true;
                setCurrentPage(page);
              }}
              onNumPages={setPdfNumPages}
              mobileToolbarAddon={<StudentAssistant inlineMobile />}
              highlights={pdfReady ? highlights : []}
              annotationsJson={pdfReady ? viewerAnnotationsJson : ""}
              onAnnotationsChange={setViewerAnnotationsJson}
              onLegacyHighlightDelete={(id) => setHighlights((prev) => prev.filter((highlight) => highlight.id !== id))}
              onRetry={() => setPdfReloadKey((prev) => prev + 1)}
              onNote={(selectedText, noteContent, page) => {
                setNotes((prev) => [
                  {
                    id: uid(),
                    page,
                    text: noteContent,
                    selectedText,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }}
            />
          ) : subject && relatedBook ? (
            <PdfFeedback
              error={pdfLoadError}
              message={pdfLoading ? pdfProgress : "Preparing your PDF…"}
              onRetry={pdfLoadError ? () => setPdfReloadKey((prev) => prev + 1) : undefined}
            />
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
        {showPanel && !audioOnlyMode && pdfReady && (
          <>
            {/* Mobile backdrop */}
            <button
              type="button"
              onClick={() => setShowPanel(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              aria-label="Close panel"
            />
            <aside
              id="study-panel"
              aria-label="Study tools"
              className={
                "fixed bottom-0 left-0 right-0 z-50 flex min-h-0 max-h-[75dvh] pb-[env(safe-area-inset-bottom)] lg:pb-0 flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-[#0d1514] " +
                "lg:static lg:z-auto lg:h-full lg:max-h-none lg:w-80 xl:w-96 lg:shrink-0 lg:rounded-none lg:rounded-l-none lg:border-l lg:border-t-0"
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
                      aria-pressed={panelTab === tab}
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
                  aria-label="Close study tools"
                  className="flex size-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white/70"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Panel body */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
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
                          onClick={() => removeStudyItem(note.id, "note")}
                          className="mt-1 text-[10px] text-red-400/70 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {!pageNotes.length && <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/55">Use Add note to save a thought about this page.</p>}

                    {/* All notes (other pages) */}
                    {allNotes.filter((n) => n.page !== currentPage).length > 0 && (
                      <>
                        <div className="mt-3 border-t border-white/10 pt-2">
                          <p className="text-[11px] font-medium text-white/40">Other pages</p>
                        </div>
                        {allNotes
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
                          onClick={() => removeStudyItem(item.id, "highlight")}
                          className="mt-1 text-[10px] text-red-400/70 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {!pageHighlights.length && <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-white/55">Select a passage in the PDF and choose Highlight.</p>}

                    {/* All highlights (other pages) */}
                    {allHighlights.filter((h) => h.page !== currentPage).length > 0 && (
                      <>
                        <div className="mt-3 border-t border-white/10 pt-2">
                          <p className="text-[11px] font-medium text-white/40">Other pages</p>
                        </div>
                        {allHighlights
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
                      onClick={addBookmarkForCurrentPage}
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
            </aside>
          </>
        )}
      </div>

      {/* The audio player stays mounted while the reader tray is collapsed. */}
      {(selectedAudio || audioOnlyMode) && <details open={audioOnlyMode || undefined} className="shrink-0 border-t border-white/10 bg-[#101b19]">
        <summary className="cursor-pointer list-none truncate px-4 py-2 text-xs font-medium text-white/75 hover:text-white">Audio lesson <span className="ml-2 text-white/45">{selectedAudio?.title}</span></summary>
      <footer
        className="shrink-0 px-3 pt-2 sm:px-6"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        {selectedAudio ? (
          <div className="mx-auto flex max-w-[1200px] flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div ref={audioPickerRef} className="relative min-w-0 w-full md:flex-1" data-audio-picker>
              {/* Mobile: labelled block so it is obvious this is audio lessons and tappable */}
              <div className="rounded-xl border border-white/12 bg-[#0d1514]/90 p-3 md:border-0 md:bg-transparent md:p-0">
                <div className="mb-2 flex items-center justify-between md:hidden">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6cf4e0]">
                    Audios
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/65">
                    {filteredAudios.length} {filteredAudios.length === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAudioPicker((v) => !v);
                  }}
                  aria-expanded={showAudioPicker}
                  aria-haspopup="listbox"
                  title="Choose a different audio lesson"
                  className="flex w-full items-center gap-2 rounded-lg border border-white/15 bg-[#0b1110] px-3 py-2.5 text-left transition hover:border-[#26d9c0]/35 hover:bg-[#0f1816] md:border-0 md:bg-transparent md:px-0 md:py-0 md:hover:border-transparent md:hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white md:hover:text-[#7cfce9]">
                      {selectedAudio.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-white/45 md:hidden">
                      {fmtTime(audioPosition)} / {fmtTime(audioDuration)}
                    </span>
                    <span className="mt-0.5 hidden text-xs text-white/55 md:block">
                      {fmtTime(audioPosition)} / {fmtTime(audioDuration)}
                    </span>
                  </div>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/50 md:border-0 md:bg-transparent ${
                      showAudioPicker ? "text-[#6cf4e0]" : ""
                    }`}
                    aria-hidden
                  >
                    <svg
                      className={`size-4 transition-transform ${showAudioPicker ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
              </div>
              {showAudioPicker && filteredAudios.length > 0 && (
                <div
                  className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-full min-w-[min(100%,100vw-1.5rem)] max-w-[min(100%,420px)] overflow-y-auto rounded-xl border border-white/15 bg-[#0d1514] p-1.5 shadow-2xl md:w-[min(100%,360px)] md:min-w-0"
                  role="listbox"
                  aria-label="Audio lessons"
                >
                  <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40 md:hidden">
                    Choose a lesson
                  </p>
                  {filteredAudios.map((audio) => {
                    const active = audio.id === selectedAudioId;
                    return (
                      <button
                        key={audio.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedAudioId(audio.id);
                          setShowAudioPicker(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                          active
                            ? "bg-[#26d9c0]/20 text-[#7cfce9]"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                        title={audio.title}
                      >
                        {active ? (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#26d9c0]/25 text-[10px] text-[#7cfce9]">
                            ✓
                          </span>
                        ) : (
                          <span className="size-5 shrink-0 rounded-full border border-white/10" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate">{audio.title}</span>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-full text-[10px] font-medium uppercase tracking-wide text-white/35 md:hidden">
                Playback speed
              </span>
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
          </div>
        ) : (
          <div className="mx-auto max-w-[1200px] rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-3 py-1.5 text-center text-xs text-white/50">
            No audio lesson for this subject yet.
          </div>
        )}
      </footer>
      </details>}
      </div>
      {/* ── Videos / Mocks (below reader) ── */}
      {!audioOnlyMode && subject && (filteredVideos.length > 0 || filteredMocks.length > 0) ? (
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


    </div>
  );
}
