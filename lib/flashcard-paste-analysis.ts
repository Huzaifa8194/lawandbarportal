import { FLASHCARD_LIMITS, MAX_CARDS, normalizeFlashcard, parseFlashcards, type Flashcard, type FlashcardType } from "./flashcards";

export type PasteFormat = "labels" | "tabs" | "separator";
export type PasteIssue = { message: string; line: number; endLine: number };
export type PasteField = { label: string; text: string; line: number; endLine: number; limit?: number };
export type PasteRecord = {
  id: number;
  number: number | null;
  startLine: number;
  endLine: number;
  title: string;
  fields: PasteField[];
  issues: PasteIssue[];
  card?: Flashcard;
};
export type PasteAnalysis = {
  records: PasteRecord[];
  cards: Flashcard[];
  globalErrors: string[];
  ready: number;
  invalid: number;
  total: number;
  deckBytes: number;
  canImport: boolean;
};
const questionLabel = /^\s*(?:\d+[.)]\s*)?Q(?:uestion)?\s*:\s*(.*)$/i;
const questionKey = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

function inspectFields(lines: string[], start: number, end: number, format: PasteFormat, type: FlashcardType): PasteField[] {
  const fields: PasteField[] = [];
  const add = (label: string, text: string, line: number, limit?: number) => fields.push({ label, text, line, endLine: line, limit });
  if (format === "tabs") {
    const columns = lines[start].split("\t");
    const labels = type === "mcq" ? ["Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Correct answer", "Explanation", "Reference"] : ["Question", "Answer", "Reference"];
    columns.forEach((value, i) => {
      const label = labels[i] || `Extra column ${i + 1}`;
      const limit = label === "Question" ? FLASHCARD_LIMITS.question : label.startsWith("Option") ? FLASHCARD_LIMITS.option : /Answer|Explanation/.test(label) ? FLASHCARD_LIMITS.answer : label === "Reference" ? FLASHCARD_LIMITS.reference : undefined;
      add(label, value, start + 1, limit);
    });
    return fields;
  }
  if (format === "separator") {
    let current = -1;
    for (let i = start; i <= end; i++) {
      if (/^\s*===+\s*$/.test(lines[i])) { add("Answer", "", i + 1, FLASHCARD_LIMITS.answer); current = fields.length - 1; }
      else if (current < 0) { add("Question", lines[i], i + 1, FLASHCARD_LIMITS.question); current = 0; }
      else { fields[current].text += (fields[current].text ? "\n" : "") + lines[i]; fields[current].endLine = i + 1; }
    }
    return fields;
  }
  let current = -1;
  for (let i = start; i <= end; i++) {
    const question = lines[i].match(questionLabel);
    const option = type === "mcq" ? lines[i].match(/^\s*([A-Z])[.):]\s*(.*)$/i) : null;
    const label = lines[i].match(/^\s*(A(?:nswer)?|Correct(?:\s+answer)?|Explanation|Ref(?:erence)?|Law)\s*:\s*(.*)$/i);
    if (question) add("Question", question[1], i + 1, FLASHCARD_LIMITS.question);
    else if (option) add(`Option ${option[1].toUpperCase()}`, option[2], i + 1, FLASHCARD_LIMITS.option);
    else if (label) {
      const key = label[1].toLowerCase();
      if (key.startsWith("ref") || key === "law") add("Reference", label[2], i + 1, FLASHCARD_LIMITS.reference);
      else if (type === "mcq" && (key === "answer" || key.startsWith("correct"))) add("Correct answer", label[2], i + 1);
      else add(type === "mcq" ? "Explanation" : "Answer", label[2], i + 1, FLASHCARD_LIMITS.answer);
    } else if (current >= 0) { fields[current].text += "\n" + lines[i]; fields[current].endLine = i + 1; continue; }
    else continue;
    current = fields.length - 1;
  }
  return fields;
}

/** Original line numbers survive blank lines and CRLF. Each card is checked by the real parser. */
export function analyzeFlashcardPaste(source: string, format: PasteFormat, type: FlashcardType, existing: Flashcard[] = [], deck: Record<string, unknown> = {}): PasteAnalysis {
  const records: PasteRecord[] = [], globalErrors: string[] = [];
  if (source.length > FLASHCARD_LIMITS.paste) {
    return { records, cards: [], globalErrors: [`Paste has ${source.length.toLocaleString("en-US")} characters; maximum ${FLASHCARD_LIMITS.paste.toLocaleString("en-US")}. Split it into smaller pastes. Your text has not been cut off.`], ready: 0, invalid: 0, total: 0, deckBytes: 0, canImport: false };
  }
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: { start: number; end: number; preamble: boolean }[] = [];
  if (format === "tabs") lines.forEach((line, i) => { if (line.trim()) blocks.push({ start: i, end: i, preamble: false }); });
  else {
    let start = -1, preamble = false;
    const finish = (end: number) => {
      if (start < 0) return;
      while (end > start && !lines[end].trim()) end--;
      blocks.push({ start, end, preamble });
    };
    lines.forEach((line, i) => {
      if (format === "labels" && questionLabel.test(line)) { finish(i - 1); start = i; preamble = false; }
      else if (format === "separator" && /^\s*---+\s*$/.test(line)) { finish(i - 1); start = -1; }
      else if (start < 0 && line.trim()) { start = i; preamble = format === "labels"; }
    });
    finish(lines.length - 1);
  }
  let number = 0;
  const seen = new Map<string, string>();
  existing.forEach((card, i) => seen.set(questionKey(card.question), `existing deck card ${i + 1}`));
  blocks.forEach((block, id) => {
    const fields = inspectFields(lines, block.start, block.end, format, type);
    const parsed = parseFlashcards(lines.slice(block.start, block.end + 1).join("\n"), format, type);
    const record: PasteRecord = { id, number: block.preamble ? null : ++number, startLine: block.start + 1, endLine: block.end + 1, title: fields.find(field => field.label === "Question")?.text.trim().slice(0, 120) || lines[block.start].trim().slice(0, 120), fields, issues: [], card: parsed.cards[0] };
    const report = (message: string, line = record.startLine, endLine = line) => {
      if (!record.issues.some(issue => issue.message === message && issue.line === line)) record.issues.push({ message, line, endLine });
    };
    parsed.errors.forEach(error => {
      const localLine = error.match(/^Line (\d+):\s*(.*)$/);
      if (localLine) { report(localLine[2], block.start + Number(localLine[1])); return; }
      let message = error.replace(/^(Card|Row) \d+:\s*/, "");
      if (message === "An answer is required for free-text cards.") message += format === "tabs" ? " Fill in the second spreadsheet column." : format === "labels" ? " Add A: followed by the answer below this question." : " Add the answer after the === line.";
      if (/Select one correct option/.test(message)) {
        const choices = fields.filter(field => /^Option [A-E]$/.test(field.label)).map(field => field.label.replace("Option ", ""));
        message += choices.length ? ` Use ${choices.join(" or ")}${format === "tabs" ? " in the Correct column." : " after Correct:."}` : " Add options A) and B), then a Correct: letter.";
      }
      let field: PasteField | undefined;
      if (/^question:/i.test(message)) field = fields.find(field => field.label === "Question");
      else if (/^answer:/i.test(message)) field = fields.find(field => field.label === (type === "mcq" ? "Explanation" : "Answer"));
      else if (/^reference:/i.test(message)) field = fields.find(field => field.label === "Reference");
      else if (/correct option/i.test(message)) field = fields.find(field => field.label === "Correct answer");
      else if (/option/i.test(message)) field = fields.find(field => field.label.startsWith("Option") && (!field.text.trim() || field.text.length > FLASHCARD_LIMITS.option)) || fields.find(field => field.label.startsWith("Option"));
      report(message, field?.line, field?.endLine);
    });
    fields.forEach(field => {
      if (field.limit && field.text.length > field.limit && !record.issues.some(issue => issue.line === field.line && /maximum/i.test(issue.message))) {
        report(`${field.label} has ${field.text.length.toLocaleString("en-US")} characters; maximum ${field.limit.toLocaleString("en-US")}. Remove ${(field.text.length - field.limit).toLocaleString("en-US")} characters.`, field.line, field.endLine);
      }
    });
    const optionValues = new Map<string, PasteField>();
    fields.filter(field => field.label.startsWith("Option") && field.text.trim()).forEach(field => {
      const key = questionKey(field.text), previous = optionValues.get(key);
      if (previous) report(`${field.label} repeats ${previous.label} (line ${previous.line}). Give each option different text.`, field.line, field.endLine);
      else optionValues.set(key, field);
    });
    const question = fields.find(field => field.label === "Question");
    if (question?.text.trim()) {
      const key = questionKey(question.text), previous = seen.get(key);
      if (previous) report(`Duplicate question: matches ${previous}. Remove this card or change its question.`, question.line, question.endLine);
      else seen.set(key, `pasted card ${record.number} (line ${record.startLine})`);
    }
    records.push(record);
  });
  if (existing.length + number > MAX_CARDS) globalErrors.push(`${existing.length} existing + ${number} pasted = ${existing.length + number} cards. A deck allows ${MAX_CARDS}; move ${existing.length + number - MAX_CARDS} cards to another deck.`);
  const cards = records.filter(record => !record.issues.length && record.card).map(record => record.card!);
  const normalizedExisting = existing.map(card => { try { return normalizeFlashcard(card); } catch { return card; } });
  const deckBytes = new TextEncoder().encode(JSON.stringify({ ...deck, cards: [...normalizedExisting, ...cards] })).length;
  if (deckBytes > FLASHCARD_LIMITS.deckBytes) globalErrors.push(`The combined deck save is ${deckBytes.toLocaleString("en-US")} bytes; maximum ${FLASHCARD_LIMITS.deckBytes.toLocaleString("en-US")} bytes (750 KB). Split it into smaller decks.`);
  const invalid = records.filter(record => record.issues.length > 0).length;
  return { records, cards, globalErrors, ready: cards.length, invalid, total: number, deckBytes, canImport: cards.length > 0 && !invalid && !globalErrors.length };
}

/** Selection offsets for the actual textarea value, including Windows CRLF pairs. */
export function pasteLineSelection(source: string, line: number, endLine = line) {
  const rows = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) || [""];
  let start = 0;
  for (let i = 0; i < Math.max(0, line - 1) && i < rows.length; i++) start += rows[i].length;
  let end = start;
  for (let i = Math.max(0, line - 1); i < Math.min(rows.length, endLine); i++) end += rows[i].length;
  return { start: Math.min(start, source.length), end: Math.min(end, source.length) };
}
