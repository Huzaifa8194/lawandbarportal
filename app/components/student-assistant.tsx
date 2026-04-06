"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { usePortalLiveData } from "../lib/use-portal-live";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function summarizeTitles(values: string[], limit = 12) {
  if (!values.length) return "None";
  return values.slice(0, limit).join(", ");
}

function pageLabel(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/subjects") return "Subjects";
  if (pathname.startsWith("/subjects/flk1")) return "FLK 1 Subjects";
  if (pathname.startsWith("/subjects/flk2")) return "FLK 2 Subjects";
  if (pathname.startsWith("/subjects/")) return "Subject Workspace";
  if (pathname.startsWith("/mocks")) return "Mock Exams";
  if (pathname.startsWith("/progress")) return "Progress";
  return "User Portal";
}

function buildKnowledgeBase(pathname: string, data: ReturnType<typeof usePortalLiveData>) {
  const { subjects, books, audios, videos, mcqs, mocks, attempts } = data;
  const pathParts = pathname.split("/").filter(Boolean);
  const isSubjectWorkspace = pathParts[0] === "subjects" && pathParts[1] && pathParts[1] !== "flk1" && pathParts[1] !== "flk2";
  const subjectId = isSubjectWorkspace ? decodeURIComponent(pathParts[1]) : "";
  const activeSubject = subjects.find((subject) => subject.id === subjectId) || null;

  const activeSubjectBooks = activeSubject
    ? books.filter((book) => book.subjectId === activeSubject.id)
    : [];
  const activeSubjectAudios = activeSubject
    ? audios.filter((audio) => audio.subjectId === activeSubject.id)
    : [];
  const activeSubjectVideos = activeSubject
    ? videos.filter((video) => video.subjectId === activeSubject.id)
    : [];
  const activeSubjectMocks = activeSubject
    ? mocks.filter((mock) => mock.subjectIds.includes(activeSubject.id))
    : [];

  const flk1Subjects = subjects
    .filter((subject) => subject.track === "FLK 1")
    .map((subject) => subject.name);
  const flk2Subjects = subjects
    .filter((subject) => subject.track === "FLK 2")
    .map((subject) => subject.name);

  const lines = [
    "=== LAW & BAR STUDENT PORTAL KNOWLEDGE BASE ===",
    "",
    "[Dashboard]",
    "Purpose: high-level overview of study portal activity.",
    "Contains: FLK 1 subjects count, FLK 2 subjects count, mock attempts count, activity count, recent mock attempts.",
    "Typical actions: open subject workspace, open FLK pages, review recent mock results.",
    "",
    "[FLK1 Page]",
    "Purpose: browse FLK 1 subjects only.",
    "Contains: FLK 1 subjects list cards and links to /subjects/[id].",
    `Published FLK 1 subjects (${flk1Subjects.length}): ${summarizeTitles(flk1Subjects, 60)}`,
    "",
    "[FLK2 Page]",
    "Purpose: browse FLK 2 subjects only.",
    "Contains: FLK 2 subjects list cards and links to /subjects/[id].",
    `Published FLK 2 subjects (${flk2Subjects.length}): ${summarizeTitles(flk2Subjects, 60)}`,
    "",
    "[/subjects/[id] Workspace]",
    "Purpose: detailed per-subject study workspace.",
    "Contains: PDF study area, notes, highlights, bookmarks, audio player, video lessons, related mock links.",
    activeSubject
      ? `Current subject: ${activeSubject.name} (${activeSubject.track})`
      : "Current subject: not on a subject workspace page right now.",
    activeSubject
      ? `Current subject resources: books=${activeSubjectBooks.length}, audios=${activeSubjectAudios.length}, videos=${activeSubjectVideos.length}, related_mocks=${activeSubjectMocks.length}`
      : "Current subject resources: unavailable (not in /subjects/[id]).",
    "",
    "[Mocks Page]",
    "Purpose: start mock exams and practice MCQs.",
    "Contains: list of published mocks with track, duration, and mode links (practice/exam).",
    `Published mocks (${mocks.length}): ${summarizeTitles(mocks.map((mock) => mock.title), 50)}`,
    "",
    "[Progress Page]",
    "Purpose: track learning and assessment progress.",
    "Contains: subjects viewed, audio played, best/average mock score, subject-view history, mock-attempt history.",
    `Attempt entries available: ${attempts.length}`,
    "",
    "[Global Portal Data Snapshot]",
    `Current path: ${pathname}`,
    `Published totals: subjects=${subjects.length}, books=${books.length}, audios=${audios.length}, videos=${videos.length}, mcqs=${mcqs.length}, mocks=${mocks.length}`,
    `Subject names: ${summarizeTitles(subjects.map((subject) => subject.name), 80)}`,
    `Book titles: ${summarizeTitles(books.map((book) => book.title), 80)}`,
    `Audio titles: ${summarizeTitles(audios.map((audio) => audio.title), 80)}`,
    `Video titles: ${summarizeTitles(videos.map((video) => video.title), 80)}`,
    "",
    "Behavior instruction: Prefer portal-grounded answers. If user asks something outside this KB snapshot, mention limitation.",
  ];

  return lines.join("\n");
}

export default function StudentAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I can help you navigate this page, find resources, and plan your study actions.",
    },
  ]);

  const portalData = usePortalLiveData();
  const { subjects, books, audios, videos, mcqs, mocks, attempts } = portalData;
  const label = pageLabel(pathname);

  const context = useMemo(() => {
    const fullKnowledgeBase = buildKnowledgeBase(pathname, portalData);
    const promptMetadata = [
      `Current page label: ${label}`,
      `Recent attempt ids: ${summarizeTitles(attempts.map((attempt) => attempt.id), 8)}`,
    ].join("\n");
    return `${fullKnowledgeBase}\n\n=== PROMPT METADATA ===\n${promptMetadata}`;
  }, [label, pathname, portalData, attempts]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, context }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Could not get a response.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: payload.answer || "" }]);
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : "Something went wrong while contacting the assistant.";
      setMessages((prev) => [...prev, { role: "assistant", content: `I couldn't answer right now: ${fallback}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-3 top-1/2 z-[70] -translate-y-1/2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-l-xl rounded-r-md bg-[#0f172a] px-2 py-3 text-xs font-semibold tracking-wide text-slate-100 shadow-lg ring-1 ring-white/10 hover:bg-[#111c32] [writing-mode:vertical-rl]"
        >
          Ask AI
        </button>
      ) : (
        <div className="h-[min(72vh,620px)] w-[min(88vw,390px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-3 py-2">
            <p className="text-sm font-semibold text-slate-100">Study Assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="h-[calc(100%-138px)] space-y-2 overflow-y-auto bg-[#0b1220] p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "mr-6 border border-white/10 bg-[#1e293b] text-slate-100"
                    : "ml-7 border border-[#26d9c0]/35 bg-[#0d4a42] text-[#eafffb]"
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading ? <p className="text-xs text-slate-400">Thinking...</p> : null}
          </div>
          <div className="border-t border-white/10 bg-[#0f172a] p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Ask about ${label.toLowerCase()}...`}
              className="h-20 w-full resize-none rounded-xl border border-white/15 bg-[#111827] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 ring-[#26d9c0]/60 focus:ring"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-[#26d9c0] px-3 py-1.5 text-sm font-semibold text-[#053d37] shadow hover:bg-[#3de8d0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
