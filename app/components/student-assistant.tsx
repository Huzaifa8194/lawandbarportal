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
  description: string;
  greeting: string;
  quickActions: string[];
};

const STUDY_MODES: StudyMode[] = [
  {
    id: "mcq",
    label: "MCQ Practice",
    icon: "?",
    description: "SQE-style questions with explanations",
    greeting:
      "Ready to test your knowledge! Pick a subject area below or tell me what topic you'd like MCQs on. I'll give you SQE-style single-best-answer questions with full explanations.",
    quickActions: [
      "Contract Law MCQ",
      "Tort Law MCQ",
      "Criminal Law MCQ",
      "Property Law MCQ",
      "Constitutional Law MCQ",
      "Business Law MCQ",
    ],
  },
  {
    id: "legal_qa",
    label: "Legal Q&A",
    icon: "\u2696",
    description: "Ask any law question, get exam-level answers",
    greeting:
      "Ask me anything about English & Welsh law. I'll give you thorough answers with statutes, case law, and how it relates to the SQE.",
    quickActions: [
      "Explain offer and acceptance",
      "What is vicarious liability?",
      "Explain the rule in Rylands v Fletcher",
      "What are equitable remedies?",
      "Explain mens rea",
      "What is proprietary estoppel?",
    ],
  },
  {
    id: "case_analysis",
    label: "Case Analysis",
    icon: "\uD83D\uDD0D",
    description: "Work through legal scenarios step by step",
    greeting:
      "Let's work through legal scenarios together. Give me a fact pattern and I'll help you identify the issues and apply the law, or I can generate a practice scenario for you.",
    quickActions: [
      "Give me a contract scenario",
      "Give me a tort scenario",
      "Negligence problem question",
      "Land law scenario",
      "Criminal law problem",
      "Trust law scenario",
    ],
  },
  {
    id: "exam_tips",
    label: "Exam Strategy",
    icon: "\uD83C\uDFAF",
    description: "SQE tips, time management, revision tactics",
    greeting:
      "Let's sharpen your exam technique! Ask me about strategies for tackling SQE questions, time management, common traps, or how to prioritise your revision.",
    quickActions: [
      "How to approach MCQs?",
      "Time management for FLK1",
      "Common SQE traps to avoid",
      "How to eliminate wrong answers",
      "Revision priority for FLK2",
      "Exam day tips",
    ],
  },
  {
    id: "study_plan",
    label: "Study Plan",
    icon: "\uD83D\uDCCB",
    description: "Build a personalised revision schedule",
    greeting:
      "Let's build your study plan! Tell me which exam you're preparing for, when it is, and how you're feeling about each subject. I'll help create a structured plan.",
    quickActions: [
      "Create an FLK1 study plan",
      "Create an FLK2 study plan",
      "I have 4 weeks left",
      "I have 8 weeks left",
      "Help me prioritise weak areas",
      "Spaced repetition schedule",
    ],
  },
];

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

function buildKnowledgeBase(
  pathname: string,
  data: ReturnType<typeof usePortalLiveData>,
) {
  const { subjects, books, audios, videos, mcqs, mocks, attempts } = data;
  const pathParts = pathname.split("/").filter(Boolean);
  const isSubjectWorkspace =
    pathParts[0] === "subjects" &&
    pathParts[1] &&
    pathParts[1] !== "flk1" &&
    pathParts[1] !== "flk2";
  const subjectId = isSubjectWorkspace
    ? decodeURIComponent(pathParts[1])
    : "";
  const activeSubject =
    subjects.find((subject) => subject.id === subjectId) || null;

  const flk1Subjects = subjects
    .filter((subject) => subject.track === "FLK 1")
    .map((subject) => subject.name);
  const flk2Subjects = subjects
    .filter((subject) => subject.track === "FLK 2")
    .map((subject) => subject.name);

  const lines = [
    `Current page: ${pathname}`,
    `FLK 1 subjects: ${summarizeTitles(flk1Subjects, 60)}`,
    `FLK 2 subjects: ${summarizeTitles(flk2Subjects, 60)}`,
    activeSubject
      ? `Currently studying: ${activeSubject.name} (${activeSubject.track})`
      : "",
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

        const isBold = /^\*\*(.+)\*\*$/.test(line.trim());
        if (isBold) {
          return (
            <p key={i} className="font-semibold text-white">
              {line.trim().replace(/^\*\*|\*\*$/g, "")}
            </p>
          );
        }

        const isOption = /^[A-D][.)]\s/.test(line.trim());
        if (isOption) {
          return (
            <p
              key={i}
              className="ml-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-slate-200"
            >
              {line.trim()}
            </p>
          );
        }

        const isListItem = /^[-\u2022\u2013]\s/.test(line.trim());
        if (isListItem) {
          return (
            <p key={i} className="ml-2 text-slate-200">
              {line.trim()}
            </p>
          );
        }

        const isNumbered = /^\d+[.)]\s/.test(line.trim());
        if (isNumbered) {
          return (
            <p key={i} className="ml-1 text-slate-200">
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
  const isSubjectWorkspace =
    pathParts[0] === "subjects" &&
    Boolean(pathParts[1]) &&
    pathParts[1] !== "flk1" &&
    pathParts[1] !== "flk2";

  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<StudyMode | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const portalData = usePortalLiveData();
  const label = pageLabel(pathname);

  const context = useMemo(() => {
    return buildKnowledgeBase(pathname, portalData);
  }, [pathname, portalData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selectMode = useCallback((mode: StudyMode) => {
    setActiveMode(mode);
    setMessages([{ role: "assistant", content: mode.greeting }]);
    setInput("");
  }, []);

  const goHome = useCallback(() => {
    setActiveMode(null);
    setMessages([]);
    setInput("");
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !activeMode) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: msg },
    ];
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

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "Could not get a response.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: payload.answer || "" },
      ]);
    } catch (error) {
      const fallback =
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting the assistant.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't respond: ${fallback}`,
        },
      ]);
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
    <div
      className={`fixed z-[70] ${
        isSubjectWorkspace
          ? "right-3 top-1/2 -translate-y-1/2"
          : "bottom-5 right-5"
      }`}
    >
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
          <span
            className={
              isSubjectWorkspace
                ? ""
                : "inline-block text-base leading-none"
            }
          >
            {isSubjectWorkspace ? "" : "\u2696\uFE0F "}
          </span>
          SQE Study Partner
        </button>
      ) : (
        <div className="flex h-[min(80vh,680px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-slate-100 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-4 py-2.5">
            <div className="flex items-center gap-2">
              {activeMode && (
                <button
                  type="button"
                  onClick={goHome}
                  className="rounded-md px-1.5 py-0.5 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Back to modes"
                >
                  \u2190
                </button>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {activeMode
                    ? `${activeMode.icon} ${activeMode.label}`
                    : "\u2696\uFE0F SQE Study Partner"}
                </p>
                {!activeMode && (
                  <p className="text-[11px] text-slate-400">
                    Your AI law tutor
                  </p>
                )}
              </div>
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

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!activeMode ? (
              /* Mode Selection Screen */
              <div className="p-4">
                <p className="mb-1 text-[13px] font-medium text-slate-300">
                  What would you like to do?
                </p>
                <p className="mb-4 text-[11px] text-slate-500">
                  Choose a study mode to get started
                </p>
                <div className="space-y-2">
                  {STUDY_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => selectMode(mode)}
                      className="group flex w-full items-start gap-3 rounded-xl border border-white/[0.06] bg-[#111827] p-3 text-left transition-all hover:border-[#26d9c0]/30 hover:bg-[#131d30]"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e293b] text-lg transition-colors group-hover:bg-[#26d9c0]/15">
                        {mode.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100">
                          {mode.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                          {mode.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#111827]/60 p-3">
                  <p className="text-[11px] font-medium text-slate-400">
                    Covers all SQE1 & SQE2 subjects
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    FLK1: Business Law, Dispute Resolution, Contract, Tort,
                    Constitutional & Admin Law, EU Law {"\u00B7"} FLK2:
                    Property, Wills & Estates, Solicitors Accounts, Land Law,
                    Trusts, Criminal Law
                  </p>
                </div>
              </div>
            ) : (
              /* Chat View */
              <div className="flex h-full flex-col">
                <div className="flex-1 p-3">
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
                        {message.role === "assistant" ? (
                          <FormattedMessage content={message.content} />
                        ) : (
                          message.content
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="mr-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#1e293b] px-3 py-2.5">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#26d9c0] [animation-delay:300ms]" />
                        </div>
                        <span className="text-xs text-slate-400">
                          Thinking...
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick action chips — only show at the start */}
                  {messages.length === 1 &&
                    messages[0].role === "assistant" && (
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
              </div>
            )}
          </div>

          {/* Input (only show in chat mode) */}
          {activeMode && (
            <div className="border-t border-white/10 bg-[#0f172a] p-3">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeMode.id === "mcq"
                      ? "Type your answer or ask for a question..."
                      : `Ask about ${label.toLowerCase()}...`
                  }
                  rows={1}
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-[#111827] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition-colors focus:border-[#26d9c0]/40"
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-[#26d9c0] text-[#053d37] shadow transition-all hover:bg-[#3de8d0] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                  </svg>
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[10px] text-slate-500">
                  Shift+Enter for new line
                </p>
                <button
                  type="button"
                  onClick={goHome}
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 transition-colors hover:border-[#26d9c0]/40 hover:text-[#26d9c0]"
                >
                  Back to study modes
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
