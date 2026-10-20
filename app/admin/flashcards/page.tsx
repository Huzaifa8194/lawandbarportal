"use client";
import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/admin/admin-guard";
import AdminShell from "@/app/components/admin/admin-shell";
import { adminApi } from "@/lib/services/admin-api";
import { parseFlashcards, type Flashcard, type FlashcardDeck } from "@/lib/flashcards";
import type { Subject } from "@/lib/types/admin";

const empty = { id: "", title: "", subjectId: "", topic: "", published: false };
const examples = { labels: "Q: Paste your first question here\nA: Paste the answer here.\nKeep paragraphs and lists on separate lines.\nReference: Optional statute or case citation\n\nQ: Paste your next question here\nA: Paste the next answer here.", tabs: "Question\tAnswer\tOptional legal reference", separator: "First question\n===\nFirst answer, including paragraphs or lists\n---\nNext question\n===\nNext answer" };
const input = "w-full rounded-lg border border-slate-300 bg-white p-3 text-sm";
export default function FlashcardAdmin() {
  const [subjects, setSubjects] = useState<Subject[]>([]), [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [form, setForm] = useState(empty), [cards, setCards] = useState<Flashcard[]>([]);
  const [mode, setMode] = useState("bulk"), [format, setFormat] = useState<keyof typeof examples>("labels"), [source, setSource] = useState("");
  const [single, setSingle] = useState<Flashcard>({ question: "", answer: "", reference: "" });
  const [errors, setErrors] = useState<string[]>([]), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [search, setSearch] = useState("");
  const [reviewPage, setReviewPage] = useState(0);
  const currentReviewPage = Math.min(reviewPage, Math.max(0, Math.ceil(cards.length / 10) - 1));
  useEffect(() => {
    if (!cards.length && !source.trim() && !form.title.trim()) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [cards.length, source, form.title]);
  const load = async () => { const [s, d] = await Promise.all([adminApi.listSubjects(), adminApi.listFlashcards()]); setSubjects(s as Subject[]); setDecks(d); };
  useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
  const preview = () => {
    const result = parseFlashcards(source, format); setErrors(result.errors);
    if (!result.errors.length) { setCards(previous => [...previous, ...result.cards]); setSource(""); setMessage(`${result.cards.length} cards added to review. Nothing has been published yet.`); }
  };
  const save = async () => {
    setBusy(true); setMessage("");
    try { await adminApi.saveFlashcards({ ...form, cards }); setForm(empty); setCards([]); await load(); setMessage("Deck saved."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  };
  const edit = async (id: string) => {
    if ((cards.length || source.trim() || form.title) && !confirm("Discard your current unsaved changes?")) return;
    setBusy(true);
    try { const deck = await adminApi.getFlashcards(id); setForm({ id: deck.id, title: deck.title, subjectId: deck.subjectId, topic: deck.topic, published: deck.published }); setCards(deck.cards || []); setSource(""); setErrors([]); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch(e) { setMessage(e instanceof Error ? e.message : "Load failed"); } finally { setBusy(false); }
  };
  return <AdminGuard><AdminShell title="Q&A flashcards" subtitle="Organise revision into FLK subjects, topics and decks. Paste up to 500 cards into each deck.">
    {message && <p role="status" className="rounded-lg border bg-white p-4 text-sm">{message}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><fieldset disabled={busy} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{form.id ? "Edit deck" : "Create a deck"}</h3><button disabled={busy} onClick={() => { if (confirm("Discard unsaved changes and start a new deck?")) { setForm(empty); setCards([]); setSource(""); setErrors([]); } }} className="text-sm underline">New deck</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Deck title<input className={input} value={form.title} maxLength={160} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Formation of a contract" /></label>
        <label className="space-y-1 text-sm">FLK subject<select className={input} value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })}><option value="">Choose subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.track} / {s.name}</option>)}</select></label>
        <label className="space-y-1 text-sm">Topic / chapter<input className={input} value={form.topic} maxLength={160} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Offer and acceptance" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />Publish for students (leave off to save a draft)</label>
      </div>
      <div className="flex gap-2 border-t pt-5">{[ ["bulk", "Paste many Q&As"], ["single", "Add individually"] ].map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-lg px-4 py-2 text-sm ${mode === value ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{label}</button>)}</div>
      {mode === "bulk" ? <div className="space-y-3">
        <label className="block text-sm">Paste format<select className={input} value={format} onChange={e => { setFormat(e.target.value as keyof typeof examples); setErrors([]); }}><option value="labels">Q: / A: labels (multiline answers)</option><option value="tabs">Spreadsheet columns (question, answer, reference)</option><option value="separator">=== between sides, --- between cards</option></select></label>
        <details className="text-sm text-slate-600"><summary className="cursor-pointer">Formatting guide and example</summary><p className="my-2">Labels must start a new line. Reference: or Law: adds an optional citation; citations are stored as supplied, not legally verified. For tables, copy 2–3 columns without headers. Formatting is plain text: line breaks and lists are preserved; HTML is never executed.</p><pre className="overflow-auto rounded-lg bg-slate-50 p-3 whitespace-pre-wrap">{examples[format]}</pre></details>
        <label className="block text-sm">Questions and answers<textarea className={`${input} mt-1 min-h-64 font-mono`} value={source} maxLength={700000} onChange={e => setSource(e.target.value)} placeholder={examples[format]} /></label>
        <button disabled={!source.trim() || busy} onClick={preview} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">Parse and add to review</button>
        {errors.length > 0 && <div role="alert" className="max-h-48 overflow-auto rounded-lg bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Fix these before importing. No cards from this paste were added.</p>{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
      </div> : <div className="space-y-3">{(["question", "answer", "reference"] as const).map(key => <label key={key} className="block text-sm capitalize">{key}{key === "reference" ? " (optional statute / case)" : ""}<textarea className={input} rows={key === "answer" ? 5 : 2} value={single[key]} onChange={e => setSingle({ ...single, [key]: e.target.value })} /></label>)}<button disabled={!single.question.trim() || !single.answer.trim()} onClick={() => { setCards([...cards, { ...single }]); setSingle({ question: "", answer: "", reference: "" }); }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">Add to review</button></div>}
      <div className="border-t pt-5"><h3 className="font-semibold">Review cards ({cards.length} / 500)</h3>{cards.length > 10 && <div className="my-3 flex items-center gap-4 text-sm"><button disabled={currentReviewPage === 0} onClick={() => setReviewPage(currentReviewPage - 1)} className="underline disabled:opacity-30">Previous</button><span>Page {currentReviewPage + 1} of {Math.ceil(cards.length / 10)}</span><button disabled={(currentReviewPage + 1) * 10 >= cards.length} onClick={() => setReviewPage(currentReviewPage + 1)} className="underline disabled:opacity-30">Next</button></div>}<p className="mt-1 text-sm text-slate-500">Edit any text below before saving. Blank answers and duplicate questions block saving.</p><div className="mt-4 max-h-[600px] space-y-4 overflow-auto">{cards.map((card, i) => ({card, i})).slice(currentReviewPage * 10, currentReviewPage * 10 + 10).map(({card, i}) => <article key={i} className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex justify-between text-sm"><strong>Card {i + 1}</strong><button onClick={() => setCards(cards.filter((_, index) => index !== i))} className="text-red-700">Remove</button></div>{(["question", "answer", "reference"] as const).map(key => <label key={key} className="mb-2 block text-sm capitalize">{key}<textarea className={input} rows={key === "answer" ? 4 : 2} value={card[key]} onChange={e => setCards(cards.map((c, index) => index === i ? { ...c, [key]: e.target.value } : c))} /></label>)}</article>)}</div></div>
      {source.trim() && <p className="text-sm text-amber-800">There is unparsed text. Add it to review or clear it before saving.</p>}
      <button onClick={save} disabled={busy || !cards.length || cards.length > 500 || !form.title.trim() || !form.subjectId || !form.topic.trim() || !!source.trim()} className="rounded-lg bg-emerald-800 px-5 py-3 font-medium text-white disabled:opacity-40">{busy ? "Working…" : form.published ? "Save and publish deck" : "Save draft deck"}</button>
    </fieldset></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-semibold">Deck library</h3><input aria-label="Search decks" className={`${input} my-4`} placeholder="Search title, subject or topic" value={search} onChange={e => setSearch(e.target.value)} /><div className="space-y-3">{decks.filter(d => `${d.title} ${d.subjectName} ${d.topic} ${d.track}`.toLowerCase().includes(search.toLowerCase())).map(d => <article key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><h4 className="font-medium">{d.title}</h4><p className="text-sm text-slate-500">{d.track} / {d.subjectName} / {d.topic} · {d.cardCount} cards · {d.published ? "Published" : "Draft"}</p></div><div className="flex gap-4 text-sm"><button disabled={busy} onClick={() => edit(d.id)}>Edit</button><button disabled={busy} className="text-red-700" onClick={async () => { if (!confirm(`Delete ${d.title}? This cannot be undone.`)) return; setBusy(true); try { await adminApi.deleteFlashcards(d.id); if (form.id === d.id) { setForm(empty); setCards([]); } await load(); } catch(e) { setMessage(e instanceof Error ? e.message : "Delete failed"); } finally { setBusy(false); } }}>Delete</button></div></article>)}{!decks.length && <p className="text-sm text-slate-500">Create your first deck above.</p>}</div></section>
  </AdminShell></AdminGuard>;
}
