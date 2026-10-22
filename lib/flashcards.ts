export type FlashcardType = "free-text" | "mcq";
export type Flashcard = {
  /** Absent on older decks, which are free text. */
  type?: FlashcardType;
  question: string;
  answer: string;
  reference: string;
  options?: string[];
  correctOption?: number;
};
export type FlashcardDeck = { id: string; title: string; subjectId: string; subjectName: string; track: "FLK 1" | "FLK 2"; topic: string; published: boolean; cardCount: number; updatedAt: string; cards?: Flashcard[] };
export const FLASHCARD_COLLECTION = "portal_flashcard_decks";
export const MAX_CARDS = 500;
export const FLASHCARD_LIMITS = { question: 5000, answer: 20000, reference: 2000, option: 5000, paste: 700000, deckBytes: 750000 } as const;

/** Shared by the API and import preview; rebuilds records without trusting extra fields. */
export function normalizeFlashcard(value: unknown): Flashcard {
  if (!value || typeof value !== "object") throw new Error("Invalid card.");
  const card = value as Record<string, unknown>;
  if (card.type !== undefined && card.type !== "free-text" && card.type !== "mcq") throw new Error("Choose Free text or MCQ.");
  const read = (key: string, limit: number, optional = false) => {
    const text = card[key];
    if (optional && (text === undefined || text === "")) return "";
    if (typeof text !== "string") throw new Error(`${key}: text is required.`);
    if (text.length > limit) throw new Error(`${key}: ${text.length.toLocaleString("en-US")} characters; maximum ${limit.toLocaleString("en-US")}. Remove ${(text.length - limit).toLocaleString("en-US")} characters.`);
    return text.trim();
  };
  const type = card.type === "mcq" ? "mcq" : "free-text";
  const question = read("question", FLASHCARD_LIMITS.question), answer = read("answer", FLASHCARD_LIMITS.answer, type === "mcq"), reference = read("reference", FLASHCARD_LIMITS.reference, true);
  if (!question) throw new Error("A question is required.");
  if (type === "free-text") {
    if (!answer) throw new Error("An answer is required for free-text cards.");
    return { type, question, answer, reference };
  }
  if (!Array.isArray(card.options) || card.options.length < 2 || card.options.length > 5) throw new Error("MCQs need 2–5 options.");
  const options = card.options.map(option => {
    if (typeof option !== "string" || !option.trim() || option.length > FLASHCARD_LIMITS.option) throw new Error("Each MCQ option needs text (maximum 5,000 characters).");
    return option.trim();
  });
  if (new Set(options.map(option => option.toLowerCase().replace(/\s+/g, " "))).size !== options.length) throw new Error("MCQ options must be distinct.");
  if (typeof card.correctOption !== "number" || !Number.isInteger(card.correctOption) || card.correctOption < 0 || card.correctOption >= options.length) throw new Error("Select one correct option from this MCQ.");
  return { type, question, answer, reference, options, correctOption: card.correctOption };
}

/** Plain text keeps paragraphs/lists without executing pasted HTML. */
export function parseFlashcards(source: string, format: "labels" | "tabs" | "separator", type: FlashcardType = "free-text") {
  const cards: Flashcard[] = [], errors: string[] = [];
  const text = source.replace(/\r\n?/g, "\n");
  const add = (card: Flashcard, label: string) => {
    try { cards.push(normalizeFlashcard(card)); }
    catch (error) { errors.push(`${label}: ${error instanceof Error ? error.message : "Invalid card."}`); }
  };
  if (type === "mcq") {
    const correctIndex = (value: string) => /^[A-E]$/i.test(value.trim()) ? value.trim().toUpperCase().charCodeAt(0) - 65 : -1;
    if (format === "separator") errors.push("Use Q: labels or spreadsheet columns for MCQs.");
    else if (format === "tabs") {
      text.split("\n").filter(line => line.trim()).forEach((line, i) => {
        // Five fixed option columns allow optional D/E without ambiguous column positions.
        const parts = line.split("\t");
        if (parts.length < 7 || parts.length > 9) { errors.push(`Row ${i + 1}: use Question, A, B, C, D, E, Correct, then optional Explanation and Reference columns.`); return; }
        const options = parts.slice(1, 6);
        while (options.length && !options[options.length - 1].trim()) options.pop();
        add({ type, question: parts[0], options, correctOption: correctIndex(parts[6]), answer: parts[7] || "", reference: parts[8] || "" }, `Row ${i + 1}`);
      });
    } else {
      let card: Flashcard | null = null;
      let field: "question" | "answer" | "reference" | number | null = null;
      let number = 0;
      const finish = () => { if (card) add(card, `Card ${++number}`); };
      text.split("\n").forEach((line, i) => {
        const question = line.match(/^\s*(?:\d+[.)]\s*)?Q(?:uestion)?\s*:\s*(.*)$/i);
        const option = line.match(/^\s*([A-Z])[.):]\s*(.*)$/i);
        const label = line.match(/^\s*(Correct(?:\s+answer)?|Answer|Explanation|Ref(?:erence)?|Law)\s*:\s*(.*)$/i);
        if (question) { finish(); card = { type, question: question[1], answer: "", reference: "", options: [], correctOption: -1 }; field = "question"; }
        else if (!card) { if (line.trim()) errors.push(`Line ${i + 1}: start each MCQ with Q:.`); }
        else if (option) {
          const index = option[1].toUpperCase().charCodeAt(0) - 65;
          if (index !== card.options!.length) errors.push(`Line ${i + 1}: options must appear once each, in A–E order.`);
          else card.options!.push(option[2]);
          field = index;
        } else if (label) {
          const key = label[1].toLowerCase();
          if (key.startsWith("correct") || key === "answer") {
            if (card.correctOption !== -1) errors.push(`Line ${i + 1}: specify the correct answer only once.`);
            card.correctOption = correctIndex(label[2]); field = null;
            if (card.correctOption === -1) errors.push(`Line ${i + 1}: use one correct-answer letter, A–E.`);
          } else { field = key === "explanation" ? "answer" : "reference"; card[field] += (card[field] ? "\n" : "") + label[2]; }
        } else if (typeof field === "number") card.options![field] += "\n" + line;
        else if (field) card[field] += "\n" + line;
        else if (line.trim()) errors.push(`Line ${i + 1}: use Explanation: for text after the correct-answer letter.`);
      });
      finish();
    }
  } else if (format === "tabs") {
    text.split("\n").filter(line => line.trim()).forEach((line, i) => {
      const parts = line.split("\t");
      if (parts.length < 2 || parts.length > 3) errors.push(`Row ${i + 1}: use 2 or 3 tab-separated columns.`);
      else add({ question: parts[0], answer: parts[1], reference: parts[2] || "" }, `Row ${i + 1}`);
    });
  } else if (format === "separator") {
    text.split(/\n\s*---+\s*\n/).forEach((block, i) => {
      const parts = block.split(/\n\s*===+\s*\n/);
      if (parts.length !== 2) errors.push(`Card ${i + 1}: put === on its own line between question and answer.`);
      else add({ question: parts[0], answer: parts[1], reference: "" }, `Card ${i + 1}`);
    });
  } else {
    let question = "", answer = "", reference = "", field: "question" | "answer" | "reference" | null = null;
    let started = false;
    const finish = () => { if (started) add({ question, answer, reference }, `Card ${cards.length + errors.length + 1}`); };
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
  });
  if (!cards.length && !errors.length) errors.push("Paste at least one question and answer.");
  if (cards.length > MAX_CARDS) errors.push(`Use at most ${MAX_CARDS} cards per deck; split larger imports into several decks.`);
  return { cards, errors };
}
