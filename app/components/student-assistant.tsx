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

  const { subjects, books, audios, videos, mcqs, mocks, attempts } = usePortalLiveData();
  const label = pageLabel(pathname);

  const context = useMemo(() => {
    const pageHints: Record<string, string> = {
      Dashboard:
        "Dashboard shows FLK counts, recent mock activity, and quick links to FLK subject lists and mock results.",
      Subjects:
        "Subjects page links to FLK1 and FLK2 tracks and lists all published subjects.",
      "FLK 1 Subjects":
        "FLK 1 page focuses on published FLK 1 subjects and opens each subject workspace.",
      "FLK 2 Subjects":
        "FLK 2 page focuses on published FLK 2 subjects and opens each subject workspace.",
      "Subject Workspace":
        "Subject workspace includes PDF study, notes, highlights, bookmarks, audio player, videos, and related practice mocks.",
      "Mock Exams":
        "Mock exams page provides practice mode and exam mode with duration and question counts.",
      Progress:
        "Progress page shows study activity, subject views, and historical mock attempt scores.",
    };

    return [
      `Current page: ${label} (${pathname})`,
      `Page guidance: ${pageHints[label] || "General student portal page."}`,
      `Published subjects: ${subjects.length}`,
      `Published books: ${books.length}`,
      `Published audios: ${audios.length}`,
      `Published videos: ${videos.length}`,
      `Published MCQs: ${mcqs.length}`,
      `Published mocks: ${mocks.length}`,
      `My attempts: ${attempts.length}`,
      `Tracks available: FLK 1, FLK 2`,
      `Subject names: ${summarizeTitles(subjects.map((s) => s.name))}`,
      `Book titles: ${summarizeTitles(books.map((b) => b.title))}`,
      `Audio titles: ${summarizeTitles(audios.map((a) => a.title))}`,
      `Video titles: ${summarizeTitles(videos.map((v) => v.title))}`,
      `Mock titles: ${summarizeTitles(mocks.map((m) => m.title))}`,
      `Recent attempt ids: ${summarizeTitles(attempts.map((a) => a.id), 8)}`,
    ].join("\n");
  }, [label, pathname, subjects, books, audios, videos, mcqs, mocks, attempts]);

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
    <div className="fixed bottom-5 right-5 z-[70]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[#121f1d] px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-[#0d1715]"
        >
          Ask AI
        </button>
      ) : (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#121f1d]/10 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">Study Assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto bg-slate-50 p-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "bg-white text-slate-800 ring-1 ring-slate-200"
                    : "ml-7 bg-[#121f1d] text-white"
                }`}
              >
                {message.content}
              </div>
            ))}
            {loading ? <p className="text-xs text-slate-500">Thinking...</p> : null}
          </div>
          <div className="border-t border-slate-200 p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Ask about ${label.toLowerCase()}...`}
              className="h-20 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-[#121f1d] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
