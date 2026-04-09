"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePortalLiveData } from "../lib/use-portal-live";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StudyMode = {
  id: string;
  label: string;
  icon: string;
  greeting: string;
  quickActions: string[];
};

const STUDY_MODES: StudyMode[] = [
  {
    id: "general",
    label: "Quick Chat",
    icon: "💬",
    greeting: "Hi! I am your SQE study partner. Ask any law question or pick a mode below.",
    quickActions: [
      "Explain negligence simply",
      "Test me on Contract Law",
      "Give me 1 SQE MCQ",
      "Create a 4-week study plan",
    ],
  },
  {
    id: "mcq",
    label: "MCQ Practice",
    icon: "?",
    greeting: "Ready for MCQs. Tell me the subject and I will give one SQE-style question.",
    quickActions: ["Contract Law MCQ", "Tort Law MCQ", "Criminal Law MCQ", "Property Law MCQ"],
  },
  {
    id: "legal_qa",
    label: "Legal Q&A",
    icon: "⚖",
    greeting: "Ask me any legal topic and I will explain it clearly for SQE.",
    quickActions: ["Offer and acceptance", "Vicarious liability", "Mens rea", "Proprietary estoppel"],
  },
  {
    id: "case_analysis",
    label: "Case Analysis",
    icon: "🔍",
    greeting: "Send me a fact pattern and I will break it down issue by issue.",
    quickActions: ["Give me a contract scenario", "Negligence problem", "Land law scenario", "Criminal law scenario"],
  },
  {
    id: "exam_tips",
    label: "Exam Tips",
    icon: "🎯",
    greeting: "Need exam strategy? Ask me about timing, traps, and revision tactics.",
    quickActions: ["How to approach MCQs", "FLK1 time management", "Common SQE traps", "Exam day tips"],
  },
  {
    id: "study_plan",
    label: "Study Plan",
    icon: "📋",
    greeting: "Tell me your timeline and I will build a focused SQE study plan.",
    quickActions: ["4-week FLK1 plan", "8-week FLK2 plan", "Prioritise weak areas", "Spaced repetition plan"],
  },
];

function summarizeTitles(values: string[], limit = 12) {
  if (!values.length) return "None";
  return values.slice(0, limit).join(", ");
}

function pageLabel(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/subjects") return "Subjects";
  if (pathname === "/books") return "Books";
  if (pathname === "/audios") return "Audios";
  if (pathname.startsWith("/subjects/flk1")) return "FLK 1 Subjects";
  if (pathname.startsWith("/subjects/flk2")) return "FLK 2 Subjects";
  if (pathname.startsWith("/books/flk1")) return "FLK 1 Books";
  if (pathname.startsWith("/books/flk2")) return "FLK 2 Books";
  if (pathname.startsWith("/audios/flk1")) return "FLK 1 Audios";
  if (pathname.startsWith("/audios/flk2")) return "FLK 2 Audios";
  if (pathname.startsWith("/subjects/")) return "Subject Workspace";
  if (pathname.startsWith("/books/")) return "Book Workspace";
  if (pathname.startsWith("/audios/")) return "Audio Workspace";
  if (pathname.startsWith("/mocks")) return "Mock Exams";
  if (pathname.startsWith("/progress")) return "Progress";
  return "User Portal";
}

function buildKnowledgeBase(pathname: string, data: ReturnType<typeof usePortalLiveData>) {
  const { subjects, books, audios, videos, mcqs, mocks, attempts } = data;
  const pathParts = pathname.split("/").filter(Boolean);
  const isWorkspaceSection = ["subjects", "books", "audios"].includes(pathParts[0] || "");
  const isSubjectWorkspace =
    isWorkspaceSection && Boolean(pathParts[1]) && pathParts[1] !== "flk1" && pathParts[1] !== "flk2";
  const subjectId = isSubjectWorkspace ? decodeURIComponent(pathParts[1] || "") : "";
  const activeSubject = subjects.find((subject) => subject.id === subjectId) || null;

  const flk1Subjects = subjects.filter((subject) => subject.track === "FLK 1").map((subject) => subject.name);
  const flk2Subjects = subjects.filter((subject) => subject.track === "FLK 2").map((subject) => subject.name);

  const lines = [
    `Current page: ${pathname}`,
    `FLK 1 subjects: ${summarizeTitles(flk1Subjects, 60)}`,
    `FLK 2 subjects: ${summarizeTitles(flk2Subjects, 60)}`,
    activeSubject ? `Currently studying: ${activeSubject.name} (${activeSubject.track})` : "",
    `Available resources: ${subjects.length} subjects, ${books.length} books, ${audios.length} audios, ${videos.length} videos, ${mcqs.length} MCQs, ${mocks.length} mocks`,
    `Mock attempts: ${attempts.length}`,
  ];

  return lines.filter(Boolean).join("\n");
}

function FormattedMessage({ content }: { content: string }) {
  const parts = content.split("\n");
  return (
    <div className="space-y-1">
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;

        const isOption = /^[A-D][.)]\s/.test(line.trim());
        if (isOption) {
          return (
            <p key={i} className="ml-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-slate-200">
              {line.trim()}
            </p>
          );
        }

        return (
          <p key={i} className="text-slate-200">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function StudentAssistant() {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const isWorkspaceSection = ["subjects", "books", "audios"].includes(pathParts[0] || "");
  const isSubjectWorkspace =
    isWorkspaceSection && Boolean(pathParts[1]) && pathParts[1] !== "flk1" && pathParts[1] !== "flk2";

  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<StudyMode>(STUDY_MODES[0]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: STUDY_MODES[0].greeting }]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const portalData = usePortalLiveData();
  const label = pageLabel(pathname);

  const context = useMemo(() => buildKnowledgeBase(pathname, portalData), [pathname, portalData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selectMode = useCallback((mode: StudyMode) => {
    setActiveMode(mode);
    setMessages([{ role: "assistant", content: mode.greeting }]);
    setInput("");
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          context,
          mode: activeMode.id,
        }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Could not get a response.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: payload.answer || "" }]);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Something went wrong while contacting the assistant.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I could not respond: ${fallback}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`fixed z-[70] ${isSubjectWorkspace ? "right-3 top-1/2 -translate-y-1/2" : "bottom-5 right-5"}`}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group bg-[#0f172a] text-slate-100 shadow-lg ring-1 ring-white/10 transition-all hover:bg-[#111c32] hover:ring-[#26d9c0]/40 ${
            isSubjectWorkspace
              ? "rounded-l-xl rounded-r-md px-2 py-3 text-xs font-semibold tracking-wide [writing-mode:vertical-rl]"
              : "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
          }`}
        >
          <span className={isSubjectWorkspace ? "" : "inline-block text-base leading-none"}>{isSubjectWorkspace ? "" : "⚖️ "}</span>
          SQE Study Partner
        </button>
      ) : (
        <div className="flex h-[min(80vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-slate-100 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-100">⚖️ SQE Study Partner</p>
              <p className="text-[11px] text-slate-400">{activeMode.icon} {activeMode.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              Close
            </button>
          </div>

          <div className="border-b border-white/10 bg-[#0f172a]/60 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {STUDY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectMode(mode)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    activeMode.id === mode.id
                      ? "border-[#26d9c0]/60 bg-[#26d9c0]/15 text-[#9cf3e6]"
                      : "border-white/10 bg-[#111827] text-slate-300 hover:border-[#26d9c0]/30 hover:text-white"
                  }`}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-2.5">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-xl px-3 py-2.5 text-[13px] leading-relaxed ${
                    message.role === "assistant"
                      ? "mr-4 border border-white/[0.06] bg-[#1e293b]"
                      : "ml-6 border border-[#26d9c0]/25 bg-[#0d4a42] text-[#eafffb]"
                  }`}
                >
                  {message.role === "assistant" ? <FormattedMessage content={message.content} /> : message.content}
                </div>
              ))}

              {loading && (
                <div className="mr-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#1e293b] px-3 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs text-slate-400">Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {messages.length <= 2 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activeMode.quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => sendMessage(action)}
                    disabled={loading}
                    className="rounded-lg border border-white/[0.08] bg-[#111827] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-all hover:border-[#26d9c0]/30 hover:bg-[#131d30] hover:text-white disabled:opacity-50"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#0f172a] p-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeMode.id === "mcq" ? "Type your answer or ask for a question..." : `Ask about ${label.toLowerCase()}...`}
                rows={1}
                className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition-colors focus:border-[#26d9c0]/40"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-[#26d9c0] text-[#053d37] shadow transition-all hover:bg-[#3de8d0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </div>
  );
}
