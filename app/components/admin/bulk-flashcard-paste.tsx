"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { FLASHCARD_LIMITS, MAX_CARDS, type Flashcard, type FlashcardType } from "@/lib/flashcards";
import { analyzeFlashcardPaste, pasteLineSelection, type PasteFormat, type PasteIssue } from "@/lib/flashcard-paste-analysis";

type Props = {
  source: string;
  onChange: (source: string) => void;
  format: PasteFormat;
  type: FlashcardType;
  existing: Flashcard[];
  deck: Record<string, unknown>;
  placeholder: string;
  onImport: (cards: Flashcard[]) => void;
};
const number = (value: number) => value.toLocaleString("en-US");

export default function BulkFlashcardPaste({ source, onChange, format, type, existing, deck, placeholder, onImport }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const deferred = useDeferredValue(source);
  const analysis = useMemo(() => analyzeFlashcardPaste(deferred, format, type, existing, deck), [deferred, format, type, existing, deck]);
  const checking = source !== deferred;
  const [filter, setFilter] = useState<"all" | "invalid" | "ready">("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [jumpLine, setJumpLine] = useState(0);
  const filtered = analysis.records.filter(record => filter === "all" || (filter === "invalid" ? record.issues.length : !record.issues.length));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages - 1);
  const selected = analysis.records.find(record => record.id === selectedId) || filtered[0];
  const focus = (line: number, endLine = line) => {
    if (checking) return;
    const selection = pasteLineSelection(source, line, endLine);
    const editor = textarea.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(selection.start, selection.end);
    editor.scrollTop = Math.max(0, (line - 4) * 24);
    editor.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpLine(line);
  };
  const jump = (recordId: number, issue: PasteIssue) => { setSelectedId(recordId); focus(issue.line, issue.endLine); };
  const firstInvalid = analysis.records.find(record => record.issues.length);
  const sourceLines = deferred.replace(/\r\n?/g, "\n").split("\n");
  const lineStart = selected ? Math.max(selected.startLine, jumpLine >= selected.startLine && jumpLine <= selected.endLine ? jumpLine - 5 : selected.startLine) : 1;
  const lineEnd = selected ? Math.min(selected.endLine, lineStart + 119) : 1;
  const hasSource = !!source.trim();
  const blocked = analysis.invalid > 0 || analysis.globalErrors.length > 0;

  return <section className="space-y-4" aria-label="Live bulk import checks">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <h4 className="font-semibold text-slate-900">Limits before you paste</h4>
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <li>{MAX_CARDS} cards per deck · {MAX_CARDS - existing.length >= 0 ? MAX_CARDS - existing.length : 0} spaces left</li>
        <li>Question or MCQ option: {number(FLASHCARD_LIMITS.question)} characters</li>
        <li>Answer / explanation: {number(FLASHCARD_LIMITS.answer)} characters</li>
        <li>Legal reference: {number(FLASHCARD_LIMITS.reference)} characters</li>
        <li>One paste: {number(FLASHCARD_LIMITS.paste)} characters</li>
        <li>Complete deck save: 750 KB ({number(FLASHCARD_LIMITS.deckBytes)} bytes)</li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">Lengths include spaces and line breaks. Over-limit text is kept so you can fix it; it is never silently cut off.</p>
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="space-y-2">
        <label htmlFor="flashcard-bulk-source" className="block text-sm font-medium">Paste questions here</label>
        <p id="flashcard-paste-help" className="text-xs text-slate-500">Checks update as you type. Select an issue on the right to highlight its location here.</p>
        <textarea ref={textarea} id="flashcard-bulk-source" aria-describedby="flashcard-paste-help flashcard-paste-count" aria-invalid={hasSource && !checking && blocked} wrap="off" spellCheck={false} className={`h-[420px] w-full rounded-xl border bg-white p-3 font-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-emerald-700 ${hasSource && blocked ? "border-red-400" : "border-slate-300"}`} value={source} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
        <div id="flashcard-paste-count" className={`flex flex-wrap justify-between gap-2 text-xs ${source.length > FLASHCARD_LIMITS.paste ? "font-semibold text-red-700" : source.length > FLASHCARD_LIMITS.paste * .9 ? "text-amber-800" : "text-slate-500"}`}><span>{number(source.length)} / {number(FLASHCARD_LIMITS.paste)} paste characters</span><span>{number(sourceLines.length)} lines</span></div>
      </div>
      <div className="min-w-0 space-y-3" aria-busy={checking}>
        <div role="status" aria-live="polite" aria-atomic="true" className={`rounded-xl border p-4 text-sm ${!hasSource || checking ? "border-slate-200 bg-slate-50" : blocked ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}>
          <h4 className="font-semibold">{checking ? "Checking your latest changes…" : !hasSource ? "Ready when you are" : blocked ? "Some content needs attention" : "All pasted cards are ready"}</h4>
          <p className="mt-1">{!hasSource ? "Paste your content to see ready cards and exact error locations." : `${analysis.ready} ready · ${analysis.invalid} need attention · ${analysis.total} cards detected`}</p>
          {hasSource && <p className="mt-1 text-xs">{existing.length} existing + {analysis.total} pasted / {MAX_CARDS} deck cards · {number(analysis.deckBytes)} / {number(FLASHCARD_LIMITS.deckBytes)} save bytes{analysis.invalid ? " (ready cards only)" : ""}</p>}
        </div>
        {analysis.globalErrors.length > 0 && <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{analysis.globalErrors.map(error => <p key={error}>{error}</p>)}</div>}
        {firstInvalid && <button type="button" disabled={checking} className="text-sm font-semibold text-red-800 underline" onClick={() => jump(firstInvalid.id, firstInvalid.issues[0])}>Jump to first issue (line {firstInvalid.issues[0].line})</button>}
        {analysis.records.length > 0 && <>
          <div className="flex flex-wrap gap-2" aria-label="Filter paste checks">{([ ["all", "All", analysis.records.length], ["invalid", "Needs attention", analysis.invalid], ["ready", "Ready", analysis.ready] ] as const).map(([value, label, count]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); setSelectedId(null); setJumpLine(0); }} className={`rounded-lg border px-3 py-1.5 text-xs ${filter === value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"}`}>{label} ({count})</button>)}</div>
          <div className="max-h-72 space-y-2 overflow-auto">{filtered.slice(currentPage * 10, currentPage * 10 + 10).map(record => <div key={record.id} className={`rounded-lg border p-3 ${record.issues.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <button type="button" disabled={checking} onClick={() => { setSelectedId(record.id); setJumpLine(record.startLine); }} aria-pressed={selected?.id === record.id} className="block w-full text-left text-sm focus-visible:outline-2 focus-visible:outline-emerald-700">
              <span className={`font-semibold ${record.issues.length ? "text-red-800" : "text-emerald-800"}`}>{record.issues.length ? "! Needs attention" : "✓ Ready"} · {record.number ? `Card ${record.number}` : "Unrecognised text"} · Lines {record.startLine}–{record.endLine}</span>
              <span className="mt-1 block truncate text-slate-700">{record.title}</span>
            </button>
            {record.issues.map((issue, i) => <button type="button" key={i} disabled={checking} onClick={() => jump(record.id, issue)} className="mt-2 block w-full text-left text-xs leading-5 text-red-800 underline">Line {issue.line}: {issue.message} Select to fix.</button>)}
          </div>)}</div>
          {filtered.length === 0 && <p className="text-sm text-slate-500">No cards in this filter.</p>}
          {pages > 1 && <div className="flex items-center justify-between text-xs"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)} className="underline disabled:opacity-30">Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)} className="underline disabled:opacity-30">Next</button></div>}
        </>}
      </div>
    </div>
    {selected && <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><h4 className="font-semibold">{selected.number ? `Card ${selected.number}` : "Unrecognised text"}: highlighted source</h4><button type="button" disabled={checking} onClick={() => focus(selected.startLine, selected.endLine)} className="underline">Select this block in the editor</button></div>
      <p className="text-xs text-slate-500">Green: valid card · Red: error location · Amber: other lines in a card needing attention. Checks cover formatting, not legal accuracy.</p>
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 font-mono text-xs leading-6" aria-label="Source lines with validation highlights">{sourceLines.slice(lineStart - 1, lineEnd).map((text, i) => {
        const line = lineStart + i;
        const issues = selected.issues.filter(issue => line >= issue.line && line <= issue.endLine);
        const invalid = selected.issues.length > 0;
        return <button type="button" key={line} disabled={checking} title={issues.map(issue => issue.message).join("\n") || `Select line ${line}`} onClick={() => focus(line)} className={`flex w-full min-w-max text-left ${issues.length ? "bg-red-100 text-red-900" : invalid ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}><span className="sticky left-0 w-20 shrink-0 border-r border-current/10 bg-inherit px-2 text-right">{issues.length ? "! " : invalid ? "· " : "✓ "}{line}</span><span className="whitespace-pre px-3">{text || " "}</span></button>;
      })}</div>
      {(lineStart > selected.startLine || lineEnd < selected.endLine) && <p className="text-xs text-slate-500">Showing lines {lineStart}–{lineEnd} of this block. Select an issue to show its surrounding lines, or select the full block in the editor.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{selected.fields.map((field, i) => <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${field.limit && field.text.length > field.limit ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 text-slate-600"}`}><span className="font-medium">{field.label}</span> · Line {field.line}{field.limit ? ` · ${number(field.text.length)} / ${number(field.limit)} characters` : ""}</div>)}</div>
      {selected.card && !selected.issues.length && <details className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-emerald-900">Preview the parsed card</summary><p className="mt-3 whitespace-pre-wrap font-medium">{selected.card.question}</p>{selected.card.options?.map((option, i) => <p key={i} className="mt-2 whitespace-pre-wrap">{String.fromCharCode(65 + i)}. {option}{i === selected.card?.correctOption ? " ✓ Correct" : ""}</p>)}{selected.card.answer && <p className="mt-3 whitespace-pre-wrap">{selected.card.answer}</p>}{selected.card.reference && <p className="mt-3 whitespace-pre-wrap text-slate-600">Reference: {selected.card.reference}</p>}</details>}
    </div>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={checking || !analysis.canImport} onClick={() => { if (!checking && analysis.canImport) onImport(analysis.cards); }} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{checking ? "Checking…" : `Add ${analysis.ready} checked ${analysis.ready === 1 ? "card" : "cards"} to review`}</button>
      <p className="text-xs text-slate-500">{blocked ? "Fix every issue before adding. No pasted cards have been added." : "Adding to review does not save or publish the deck."}</p>
    </div>
  </section>;
}
