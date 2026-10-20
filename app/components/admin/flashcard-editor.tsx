"use client";

import type { Flashcard, FlashcardType } from "@/lib/flashcards";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm";

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
      <textarea className={input} rows={3} maxLength={5000} value={value.question} onChange={event => onChange({ ...value, question: event.target.value })} />
    </label>
    {mcq && <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium">Answer options</legend>
      <p className="text-sm text-slate-500">Add 2–5 distinct options and choose one correct answer.</p>
      {options.map((option, index) => <label key={index} className="block text-sm">Option {String.fromCharCode(65 + index)}
        <textarea className={input} rows={2} maxLength={5000} value={option} onChange={event => onChange({ ...value, options: options.map((text, i) => i === index ? event.target.value : text) })} />
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
      <textarea className={input} rows={5} maxLength={20000} value={value.answer} onChange={event => onChange({ ...value, answer: event.target.value })} />
    </label>
    <label className="block text-sm">Legal reference (optional statute / case)
      <textarea className={input} rows={2} maxLength={2000} value={value.reference} onChange={event => onChange({ ...value, reference: event.target.value })} />
    </label>
  </div>;
}
