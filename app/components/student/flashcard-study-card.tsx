"use client";

import type { Flashcard } from "@/lib/flashcards";

export default function FlashcardStudyCard({ card, revealed, selected, onSelect, onReveal }: {
  card: Flashcard;
  revealed: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
  onReveal: () => void;
}) {
  const mcq = card.type === "mcq";
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b-4 border-[#26d9c0] p-6 sm:p-10">
      <p className="mb-4 text-sm font-medium text-emerald-800">{mcq ? "Multiple choice" : "Free-text question"}</p>
      <h3 className="whitespace-pre-wrap font-serif text-2xl leading-relaxed">{card.question}</h3>
      {mcq && <fieldset disabled={revealed} className="mt-6 space-y-3">
        <legend className="mb-3 text-sm text-slate-600">Choose one answer</legend>
        {card.options?.map((option, index) => {
          const correct = revealed && index === card.correctOption;
          const incorrect = revealed && index === selected && !correct;
          return <label key={index} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${correct ? "border-emerald-600 bg-emerald-50" : incorrect ? "border-red-400 bg-red-50" : selected === index ? "border-slate-700 bg-slate-50" : "border-slate-200"}`}>
            <input type="radio" name="flashcard-answer" value={index} checked={selected === index} onChange={() => onSelect(index)} className="mt-1 accent-emerald-800" />
            <span className="min-w-0 whitespace-pre-wrap text-sm leading-6"><strong>{String.fromCharCode(65 + index)}.</strong> {option}{correct && <span className="mt-1 block font-semibold text-emerald-800">Correct answer</span>}{incorrect && <span className="mt-1 block font-semibold text-red-800">Your answer</span>}</span>
          </label>;
        })}
      </fieldset>}
    </div>
    <div className="p-6 sm:p-10">
      {revealed ? <div aria-live="polite">
        {mcq && <div className="mb-5 space-y-2">
          <p className={`font-semibold ${selected === card.correctOption ? "text-emerald-800" : "text-red-800"}`}>{selected === card.correctOption ? "Correct — well done." : "Not quite. Review the correct answer below."}</p>
          <p className="whitespace-pre-wrap text-sm leading-6">Correct answer: {String.fromCharCode(65 + (card.correctOption ?? 0))}. {card.options?.[card.correctOption ?? 0]}</p>
        </div>}
        {card.answer && <><p className="mb-4 text-sm font-medium text-emerald-800">{mcq ? "Explanation" : "Answer"}</p><p className="whitespace-pre-wrap text-base leading-8">{card.answer}</p></>}
        {card.reference && <aside className="mt-6 border-l-2 border-emerald-700 bg-emerald-50 p-4"><p className="text-sm font-semibold">Legal reference</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{card.reference}</p></aside>}
      </div> : <div className="py-4 text-center">
        <p className="mb-5 text-slate-500">{mcq ? "Select an option, then check your answer." : "Try answering in your own words first."}</p>
        <button disabled={mcq && selected === null} onClick={onReveal} className="rounded-xl bg-[#121f1d] px-8 py-3 font-medium text-white disabled:opacity-40">{mcq ? "Check answer" : "Reveal answer"}</button>
      </div>}
    </div>
  </article>;
}
