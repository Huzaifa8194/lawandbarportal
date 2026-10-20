export type Flashcard = { question: string; answer: string; reference: string };
export type FlashcardDeck = { id: string; title: string; subjectId: string; subjectName: string; track: "FLK 1" | "FLK 2"; topic: string; published: boolean; cardCount: number; updatedAt: string; cards?: Flashcard[] };
export const FLASHCARD_COLLECTION = "portal_flashcard_decks";
export const MAX_CARDS = 500;

/** Plain text is intentional: preserves paragraphs/lists without executing pasted HTML. */
export function parseFlashcards(source: string, format: "labels" | "tabs" | "separator") {
  const cards: Flashcard[] = [];
  const errors: string[] = [];
  const text = source.replace(/\r\n?/g, "\n").trim();
  const add = (question: string, answer: string, reference = "", label: string) => {
    if (!question.trim() || !answer.trim()) errors.push(`${label}: both a question and answer are required.`);
    else cards.push({ question: question.trim(), answer: answer.trim(), reference: reference.trim() });
  };
  if (format === "tabs") {
    text.split("\n").filter(line => line.trim()).forEach((line, i) => {
      const parts = line.split("\t");
      if (parts.length < 2 || parts.length > 3) errors.push(`Row ${i + 1}: use 2 or 3 tab-separated columns.`);
      else add(parts[0], parts[1], parts[2], `Row ${i + 1}`);
    });
  } else if (format === "separator") {
    text.split(/\n\s*---+\s*\n/).forEach((block, i) => {
      const parts = block.split(/\n\s*===+\s*\n/);
      if (parts.length !== 2) errors.push(`Card ${i + 1}: put === on its own line between question and answer.`);
      else add(parts[0], parts[1], "", `Card ${i + 1}`);
    });
  } else {
    let question = "", answer = "", reference = "", field: "question" | "answer" | "reference" | null = null;
    let started = false;
    const finish = () => { if (started) add(question, answer, reference, `Card ${cards.length + errors.length + 1}`); };
    text.split("\n").forEach((line, i) => {
      const match = line.match(/^\s*(?:\d+[.)]\s*)?(Q(?:uestion)?|A(?:nswer)?|Ref(?:erence)?|Law)\s*:\s*(.*)$/i);
      if (match) {
        const kind = match[1].toLowerCase();
        if (kind.startsWith("q")) { finish(); question = match[2]; answer = ""; reference = ""; field = "question"; started = true; }
        else if (!started) errors.push(`Line ${i + 1}: start each card with Q: or Question:.`);
        else if (kind.startsWith("a")) { field = "answer"; answer += (answer ? "\n" : "") + match[2]; }
        else { field = "reference"; reference += (reference ? "\n" : "") + match[2]; }
      } else if (field === "question") question += "\n" + line;
      else if (field === "answer") answer += "\n" + line;
      else if (field === "reference") reference += "\n" + line;
      else if (line.trim()) errors.push(`Line ${i + 1}: unrecognised text before the first Q:.`);
    });
    finish();
  }
  const seen = new Set<string>();
  cards.forEach((card, i) => {
    const key = card.question.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) errors.push(`Card ${i + 1}: duplicate question. Remove or revise it before saving.`);
    seen.add(key);
    if (card.question.length > 5000 || card.answer.length > 20000 || card.reference.length > 2000) errors.push(`Card ${i + 1}: text exceeds the size limit.`);
  });
  if (!cards.length && !errors.length) errors.push("Paste at least one question and answer.");
  if (cards.length > MAX_CARDS) errors.push(`Use at most ${MAX_CARDS} cards per deck; split larger imports into several decks.`);
  return { cards, errors };
}
