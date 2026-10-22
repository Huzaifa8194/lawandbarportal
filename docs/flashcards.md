# Q&A flashcards

Admins: open **Admin → Q&A Flashcards** (`/admin/flashcards`). Select an existing FLK subject, enter a deck title and topic/chapter, and add cards individually or paste a batch. Both entry methods offer **Free text** and **MCQ**. A deck can contain both types: choose the type for each individual card or import each type separately. Decks start as drafts. Review and edit the parsed cards, then save a draft or check “Publish for students” and save. Each review card has an editable question type.

Students: open **Q&A Flashcards** (`/flashcards`), or use the link in a subject workspace. Filter by FLK, subject or topic, select a deck, answer from memory and reveal the answer. Rate recall, shuffle, or review missed cards after the session. Recall ratings are session-only.

For MCQs, select an option and click **Check answer**. The correct option, explanation and legal reference appear afterward. Choices lock after checking. Click **Next card** to record the result; incorrect questions join the missed-card review. MCQs require 2–5 non-empty, distinct options and exactly one correct answer. Explanations are optional. Older decks without a question type continue to behave as free text; no migration is needed.

## Live feedback while pasting

Bulk imports now check automatically as you type or paste. **Green / Ready** means a card parses successfully. **Red / Needs attention** identifies errors; **amber** marks other lines in a card that still has errors. Text labels and symbols accompany colors.

The live panel shows ready/error counts, original source line numbers, remaining deck capacity, character counts for each detected field, and the combined save size in UTF-8 bytes. Choose **Needs attention** to filter the list, or **Jump to first issue**. Clicking an issue selects its original text in the paste box and shows its surrounding highlighted lines. Spreadsheet rows and leading blank lines retain their actual line numbers. Use **Preview the parsed card** to confirm how a ready card will be stored.

Checks include duplicates within the paste and against cards already in the deck. Every issue must be fixed before **Add checked cards to review** is enabled; no partial import occurs. Oversized text stays intact so it can be shortened or split, rather than being silently truncated. Large results are paginated in groups of 10, and selecting an error jumps directly to that card. Individual and review fields also display live character counters.

Checks validate formatting and structure, not legal accuracy. Saving/publishing remains a separate step.

## Paste formats

**Q:/A: labels** (also accepts Question:, Answer:, Reference:, Ref: and Law:). Each label starts a new line. Answer paragraphs and lists keep their line breaks.

```text
Q: Your first question
A: Your answer

- First point
- Second point
Reference: Optional statute or case citation

Q: Your next question
A: Your next answer
```

**Spreadsheet columns**: copy rows with question, answer and optional legal reference, separated by tabs. Omit headers. Each row is one card; use the labels or separator format for multiline cells.

**Separators**: put `===` on its own line between question and answer, and `---` on its own line between cards. This format is useful when the answer itself contains Q: or A: lines.

### MCQ imports

Choose **MCQ** for the paste, then use labels or spreadsheet columns. Separator format is available for free text only.

```text
Q: Your question
A) First option
B) Second option
C) Third option
D) Fourth option
E) Fifth option
Correct: C
Explanation: Optional explanation, with paragraphs and lists
Reference: Optional statute or case

Q: Your next question
A) First option
B) Second option
Correct: A
```

Options must appear once each, in order from A. `A.`, `A)` and `A:` option labels are accepted. Use `Correct:` or `Answer:` followed by one letter to identify the correct option. Use `Explanation:` for the explanatory text.

For spreadsheets, copy columns in this order: **Question, A, B, C, D, E, Correct, Explanation, Reference**. Keep all five option columns even when using fewer options; leave unused trailing option columns blank. Correct contains one letter (A–E). Explanation and Reference are optional final columns. Omit headers.

Pasted content is plain text. Paragraphs, lists and references are preserved; HTML, fonts and Word styling are not imported. References are supplied by the author and are not automatically checked for legal accuracy.

Malformed pastes show errors and add no cards from that paste. Duplicate questions, empty free-text answers, invalid MCQ options/correct answers and oversized content block saving. Limits: 500 cards per deck, 5,000 characters per question or option, 20,000 per answer/explanation, 2,000 per reference, and 750 KB for the complete save request. Split a larger collection into multiple topic decks. Preview editing is paginated in groups of 10 cards.

## Storage and access

Decks use the dedicated Firestore collection `portal_flashcard_decks`. No seed content or database migration is required. Admin APIs verify the Firebase token and admin role; student APIs verify portal access and return only published decks. Lists select deck metadata, and the full deck is loaded when opened. Server routes use Firebase Admin, so these routes require no new client Firestore rules.

## AI chat

Chat uses the existing Groq integration. Configure `GROQ_API_KEY` alongside the existing Firebase public and admin environment variables. `GROQ_MODEL` optionally overrides the default model. Requests now require authenticated portal access, validate messages, time out, and return readable configuration/provider errors. MCQ mode requests five answer options. The chat has portal resource summaries, not full book contents or live legal research.

Run `npm run test:flashcards` for parser, API access/validation and mocked chat tests; `npx tsc --noEmit` for type checking. Live saving, publishing and AI replies must also be checked with configured Firebase/Groq credentials and an authorised account. Mocked provider tests do not establish live provider availability or legal answer accuracy.
