"use client";
import { useEffect, useState } from "react";
import FlashcardStudyCard from "@/app/components/student/flashcard-study-card";
import PortalShell from "@/app/components/portal-shell";
import { useAuth } from "@/app/context/auth-context";
import { studentApi } from "@/lib/services/student-api";
import type { FlashcardDeck } from "@/lib/flashcards";
const field = "rounded-lg border border-slate-300 bg-white p-3 text-sm";
export default function Flashcards() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]), [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [track, setTrack] = useState(""), [subject, setSubject] = useState(""), [topic, setTopic] = useState(""), [search, setSearch] = useState("");
  const [order, setOrder] = useState<number[]>([]), [position, setPosition] = useState(0), [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [known, setKnown] = useState<number[]>([]), [review, setReview] = useState<number[]>([]), [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  useEffect(() => { if (!user) return; let cancelled = false; studentApi.listFlashcards().then(data => { if (!cancelled) { setDecks(data); setSubject(new URLSearchParams(window.location.search).get("subject") || ""); } }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setBusy(false); }); return () => { cancelled = true; }; }, [user]);
  const start = (indices: number[]) => { setOrder(indices); setPosition(0); setRevealed(false); setSelected(null); setKnown([]); setReview([]); setDone(false); };
  const open = async (id: string) => { setBusy(true); setError(""); try { const data = await studentApi.getFlashcards(id); setDeck(data); start((data.cards || []).map((_, i) => i)); } catch(e) { setError(e instanceof Error ? e.message : "Could not open deck"); } finally { setBusy(false); } };
  const mark = (remembered: boolean) => { const index = order[position]; if (remembered) setKnown([...known, index]); else setReview([...review, index]); setRevealed(false); setSelected(null); if (position + 1 === order.length) setDone(true); else setPosition(position + 1); };
  const filtered = decks.filter(d => (!track || d.track === track) && (!subject || d.subjectId === subject) && (!topic || d.topic === topic) && `${d.title} ${d.subjectName} ${d.topic}`.toLowerCase().includes(search.toLowerCase()));
  const subjects = Array.from(new Map(decks.filter(d => !track || d.track === track).map(d => [d.subjectId, d.subjectName])));
  const topics = Array.from(new Set(decks.filter(d => (!track || d.track === track) && (!subject || d.subjectId === subject)).map(d => d.topic)));
  const card = deck?.cards?.[order[position]];
  return <PortalShell title="Q&A flashcards" subtitle="Choose a topic, recall the rule, then reveal the answer.">
    {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-red-800">{error} <button onClick={() => window.location.reload()} className="underline">Retry</button></p>}
    {busy ? <p role="status" className="p-6">Loading flashcards…</p> : deck ? <section className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => setDeck(null)} className="text-sm underline">Back to all decks</button>
      <header><p className="text-sm text-slate-500">{deck.track} / {deck.subjectName} / {deck.topic}</p><h2 className="mt-2 font-serif text-3xl">{deck.title}</h2></header>
      {done ? <div className="rounded-2xl border bg-white p-8 text-center"><h3 className="font-serif text-2xl">Session complete</h3><p className="my-5">{known.length} remembered / correct · {review.length} to revisit</p><div className="flex flex-wrap justify-center gap-3">{review.length > 0 && <button className="rounded-lg bg-emerald-800 px-5 py-3 text-white" onClick={() => start(review)}>Review missed cards</button>}<button className={`${field}`} onClick={() => start((deck.cards || []).map((_, i) => i))}>Study whole deck again</button></div></div> : card ? <>
        <div className="flex items-center justify-between text-sm"><p aria-live="polite">Card {position + 1} of {order.length}</p><button className="underline" onClick={() => { const shuffled = [...order]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } start(shuffled); }}>Shuffle and restart</button></div>
        <progress className="h-2 w-full accent-emerald-700" value={position} max={order.length} aria-label="Session progress" />
        <FlashcardStudyCard card={card} revealed={revealed} selected={selected} onSelect={setSelected} onReveal={() => setRevealed(true)} />
        {revealed && (card.type === "mcq" ? <div className="text-center"><button onClick={() => mark(selected === card.correctOption)} className="rounded-xl bg-emerald-800 px-6 py-3 text-white">{position + 1 === order.length ? "Finish session" : "Next card"}</button></div> : <div className="flex flex-wrap justify-center gap-3"><button onClick={() => mark(false)} className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-3 text-amber-900">Study again</button><button onClick={() => mark(true)} className="rounded-xl bg-emerald-800 px-6 py-3 text-white">I remembered this</button></div>)}
        <p className="text-center text-xs text-slate-500">Recall ratings and MCQ results apply to this session. Incorrect MCQs join your missed-card review.</p>
      </> : <p>This deck has no cards yet.</p>}
    </section> : <>
      <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input aria-label="Search flashcards" className={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decks or topics" /><select aria-label="Filter FLK track" className={field} value={track} onChange={e => { setTrack(e.target.value); setSubject(""); setTopic(""); }}><option value="">All FLK tracks</option><option>FLK 1</option><option>FLK 2</option></select><select aria-label="Filter subject" className={field} value={subject} onChange={e => { setSubject(e.target.value); setTopic(""); }}><option value="">All subjects</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Filter topic" className={field} value={topic} onChange={e => setTopic(e.target.value)}><option value="">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select></section>
      <p className="mb-4 text-sm text-slate-500">{filtered.length} decks available</p><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(d => <button key={d.id} onClick={() => open(d.id)} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-700"><p className="text-sm text-emerald-800">{d.track} / {d.subjectName}</p><h3 className="my-3 font-serif text-2xl">{d.title}</h3><p className="text-sm text-slate-500">{d.topic}</p><div className="mt-6 flex justify-between border-t pt-4 text-sm"><span>{d.cardCount} cards</span><span className="font-medium text-emerald-800">Start studying</span></div></button>)}</div>{!filtered.length && <div className="rounded-xl border border-dashed p-10 text-center text-slate-500">{decks.length ? "No decks match these filters. Try another subject or search." : "Your flashcard library is being prepared. Published decks will appear here."}</div>}
    </>}
  </PortalShell>;
}
