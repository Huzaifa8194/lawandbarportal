"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { studentApi } from "@/lib/services/student-api";
import type { AudioStudyState, PdfHighlight, PdfNote, PdfStudyState } from "@/lib/types/student";
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

function StudyBadge({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-[#26d9c0]/50 bg-[#26d9c0]/15 text-[#6cf4e0]"
          : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export default function SubjectWorkspacePage() {
  const params = useParams<{ subjectId: string }>();
  const { user } = useAuth();
  const { subjects, books, audios, mocks, loading } = usePortalLiveData({ includeAttempts: false });
  const subject = subjects.find((item) => item.id === params.subjectId);
  const relatedBook = books.find((item) => item.subjectId === params.subjectId);
  const relatedBookId = typeof relatedBook?.id === "string" ? relatedBook.id.trim() : "";
  const relatedAudios = audios.filter((item) => item.subjectId === params.subjectId);
  const relatedMocks = mocks.filter((item) => item.subjectIds.includes(params.subjectId));

  const [activePanel, setActivePanel] = useState<"highlights" | "notes" | "audios" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Array<{ id: string; page: number; label: string }>>([]);
  const [notes, setNotes] = useState<PdfNote[]>([]);
  const [highlights, setHighlights] = useState<PdfHighlight[]>([]);
  const [noteText, setNoteText] = useState("");
  const [highlightText, setHighlightText] = useState("");
  const [highlightColor, setHighlightColor] = useState<PdfHighlight["color"]>("yellow");
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [pdfToken, setPdfToken] = useState<string | null>(null);

  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(relatedAudios[0]?.id ?? null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioRate, setAudioRate] = useState(1);
  const [audioReady, setAudioReady] = useState(false);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSelectedAudioId((prev) => (prev && relatedAudios.some((a) => a.id === prev) ? prev : relatedAudios[0]?.id ?? null));
  }, [relatedAudios]);

  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      if (!user) {
        setPdfToken(null);
        return;
      }
      try {
        const token = await user.getIdToken();
        if (!cancelled) setPdfToken(token);
      } catch {
        if (!cancelled) setPdfToken(null);
      }
    };
    void loadToken();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
  const pageHighlights = highlights.filter((item) => item.page === currentPage);
  const pageNotes = notes.filter((item) => item.page === currentPage);
  const pdfUrl =
    relatedBookId && pdfToken
      ? `/api/student/books/${encodeURIComponent(relatedBookId)}/file?token=${encodeURIComponent(pdfToken)}`
      : null;
  const pdfDocuments = useMemo(
    () =>
      pdfUrl
        ? [
            {
              uri: pdfUrl,
              fileType: "pdf",
              fileName: `${relatedBook?.title || "Study Book"}.pdf`,
            },
          ]
        : [],
    [pdfUrl, relatedBook?.title],
  );
  const backTrackHref = subject?.track === "FLK 2" ? "/subjects/flk2" : "/subjects/flk1";

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
                <Link href={backTrackHref} className="hover:text-[#26d9c0]">
                  {subject?.track || "FLK"}
                </Link>
                <span>/</span>
                <span>Study</span>
              </div>
              <h1 className="truncate font-[family-name:var(--font-playfair)] text-xl font-semibold sm:text-2xl">
                {subject?.name || "Subject Study Workspace"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <StudyBadge
                active={activePanel === "highlights"}
                label="Highlights"
                onClick={() => setActivePanel((prev) => (prev === "highlights" ? null : "highlights"))}
              />
              <StudyBadge
                active={activePanel === "notes"}
                label="Notes"
                onClick={() => setActivePanel((prev) => (prev === "notes" ? null : "notes"))}
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

          {activePanel === "notes" ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Current page notes</span>
                  <span>Page {currentPage}</span>
                </div>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Write a quick study note..."
                  className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2 text-sm text-white placeholder:text-white/35"
                />
                <div className="mt-2 flex gap-2">
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
                    className="rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea]"
                  >
                    Save note
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteText("")}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-44 space-y-2 overflow-auto rounded-lg border border-white/10 bg-[#0f1716] p-2">
                {pageNotes.map((note) => (
                  <div key={note.id} className="rounded-md bg-white/5 px-2 py-1.5 text-sm">
                    {note.text}
                  </div>
                ))}
                {!pageNotes.length ? <p className="px-2 py-3 text-xs text-white/50">No notes for this page.</p> : null}
              </div>
            </div>
          ) : null}

          {activePanel === "highlights" ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={highlightText}
                    onChange={(event) => setHighlightText(event.target.value)}
                    placeholder="Paste important passage..."
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2 text-sm text-white placeholder:text-white/35"
                  />
                  <select
                    value={highlightColor}
                    onChange={(event) => setHighlightColor(event.target.value as PdfHighlight["color"])}
                    className="rounded-lg border border-white/10 bg-[#0f1716] px-3 py-2 text-sm text-white"
                  >
                    <option value="yellow">Yellow</option>
                    <option value="green">Green</option>
                    <option value="blue">Blue</option>
                    <option value="pink">Pink</option>
                  </select>
                  <button
                    type="button"
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
                    className="rounded-lg border border-[#26d9c0]/60 bg-[#26d9c0]/15 px-3 py-2 text-sm font-medium text-[#78ffea]"
                  >
                    Save
                  </button>
                </div>

                <div className="mt-2 max-h-40 space-y-2 overflow-auto rounded-lg border border-white/10 bg-[#0f1716] p-2">
                  {pageHighlights.map((item) => (
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
                  {!pageHighlights.length ? (
                    <p className="px-2 py-3 text-xs text-white/50">No highlights for this page.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0f1716] p-3">
                <p className="text-sm font-medium text-white">Study tools</p>
                <button
                  type="button"
                  onClick={() =>
                    setBookmarks((prev) => [
                      { id: uid(), page: currentPage, label: `Page ${currentPage}` },
                      ...prev,
                    ])
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90"
                >
                  Bookmark current page
                </button>
                <div className="mt-3 max-h-32 space-y-1 overflow-auto text-xs text-white/70">
                  {bookmarks.map((mark) => (
                    <button
                      type="button"
                      key={mark.id}
                      onClick={() => setCurrentPage(mark.page)}
                      className="block w-full rounded-md px-2 py-1 text-left hover:bg-white/10"
                    >
                      {mark.label}
                    </button>
                  ))}
                  {!bookmarks.length ? <p className="px-2 py-2 text-white/45">No bookmarks yet.</p> : null}
                </div>
              </div>
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
              <p>{relatedBook?.title || "No PDF book is currently available for this subject."}</p>
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
                    onClick={() => setCurrentPage((prev) => prev + 1)}
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
                  <div className="rounded-[18px] bg-[#f8f7f4] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ring-1 ring-black/10">
                    <div className="flex h-[60vh] min-h-[420px] w-full items-start justify-center overflow-auto rounded-[12px] bg-white p-2 text-slate-900 sm:h-[70vh] sm:p-4">
                      <div className="h-full w-full overflow-hidden rounded-lg border border-slate-200">
                        <DocViewer
                          documents={pdfDocuments}
                          pluginRenderers={DocViewerRenderers}
                          config={{
                            header: {
                              disableHeader: true,
                              disableFileName: true,
                              retainURLParams: false,
                            },
                          }}
                          style={{ height: "100%", width: "100%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto mt-3 w-fit rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    Page {currentPage}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm text-white/75">
                  PDF is not available for this subject yet. Ask admin to upload and publish the book.
                </div>
              )}
            </div>

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
