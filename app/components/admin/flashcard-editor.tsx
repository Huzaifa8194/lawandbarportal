"use client";

import { FLASHCARD_LIMITS, type Flashcard, type FlashcardType } from "@/lib/flashcards";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm";

function FieldLength({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return <span className={`mt-1 block text-xs ${over ? "font-semibold text-red-700" : value.length > limit * .9 ? "text-amber-800" : "text-slate-500"}`} aria-live="polite">{value.length.toLocaleString("en-US")} / {limit.toLocaleString("en-US")} characters{over ? ` · Remove ${(value.length - limit).toLocaleString("en-US")} characters before saving.` : " (including spaces and line breaks)"}</span>;
}

export default function FlashcardEditor({ value, onChange }: {
  value: Flashcard;
  onChange: (card: Flashcard) => void;
}) {
  const mcq = value.type === "mcq";
  const options = value.options || ["", "", "", "", ""];
  const changeType = (type: FlashcardType) => onChange(type === "mcq"
    ? { ...value, type, options, correctOption: value.correctOption ?? -1 }
    : { ...value, type });

  return <div className="space-y-3">
    <label className="block text-sm">Question type
      <select className={input} value={value.type || "free-text"} onChange={event => changeType(event.target.value as FlashcardType)}>
        <option value="free-text">Free text</option>
        <option value="mcq">MCQ</option>
      </select>
    </label>
    <label className="block text-sm">Question
      <textarea className={input} rows={3} value={value.question} onChange={event => onChange({ ...value, question: event.target.value })} aria-invalid={value.question.length > FLASHCARD_LIMITS.question} /><FieldLength value={value.question} limit={FLASHCARD_LIMITS.question} />
    </label>
    {mcq && <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium">Answer options</legend>
      <p className="text-sm text-slate-500">Add 2–5 distinct options and choose one correct answer.</p>
      {options.map((option, index) => <label key={index} className="block text-sm">Option {String.fromCharCode(65 + index)}
        <textarea className={input} rows={2} value={option} onChange={event => onChange({ ...value, options: options.map((text, i) => i === index ? event.target.value : text) })} aria-invalid={option.length > FLASHCARD_LIMITS.option} /><FieldLength value={option} limit={FLASHCARD_LIMITS.option} />
      </label>)}
      <div className="flex flex-wrap gap-4 text-sm">
        <button type="button" disabled={options.length >= 5} className="underline disabled:opacity-30" onClick={() => onChange({ ...value, options: [...options, ""] })}>Add option</button>
        <button type="button" disabled={options.length <= 2} className="underline disabled:opacity-30" onClick={() => onChange({ ...value, options: options.slice(0, -1), correctOption: value.correctOption === options.length - 1 ? -1 : value.correctOption })}>Remove last option</button>
      </div>
      <label className="block text-sm">Correct answer
        <select className={input} value={value.correctOption ?? -1} onChange={event => onChange({ ...value, correctOption: Number(event.target.value) })}>
          <option value={-1}>Select correct option</option>
          {options.map((_, i) => <option key={i} value={i}>Option {String.fromCharCode(65 + i)}</option>)}
        </select>
      </label>
    </fieldset>}
    <label className="block text-sm">{mcq ? "Explanation (optional)" : "Answer"}
      <textarea className={input} rows={5} value={value.answer} onChange={event => onChange({ ...value, answer: event.target.value })} aria-invalid={value.answer.length > FLASHCARD_LIMITS.answer} /><FieldLength value={value.answer} limit={FLASHCARD_LIMITS.answer} />
    </label>
    <label className="block text-sm">Legal reference (optional statute / case)
      <textarea className={input} rows={2} value={value.reference} onChange={event => onChange({ ...value, reference: event.target.value })} aria-invalid={value.reference.length > FLASHCARD_LIMITS.reference} /><FieldLength value={value.reference} limit={FLASHCARD_LIMITS.reference} />
    </label>
  </div>;
}
