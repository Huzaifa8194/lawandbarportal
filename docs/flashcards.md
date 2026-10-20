# Q&A flashcards

Admins: open **Admin → Q&A Flashcards** (`/admin/flashcards`). Select an existing FLK subject, enter a deck title and topic/chapter, and add cards individually or paste a batch. Decks start as drafts. Review and edit the parsed cards, then save a draft or check “Publish for students” and save.

Students: open **Q&A Flashcards** (`/flashcards`), or use the link in a subject workspace. Filter by FLK, subject or topic, select a deck, answer from memory and reveal the answer. Rate recall, shuffle, or review missed cards after the session. Recall ratings are session-only.

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

Pasted content is plain text. Paragraphs, lists and references are preserved; HTML, fonts and Word styling are not imported. References are supplied by the author and are not automatically checked for legal accuracy.

Malformed pastes show errors and add no cards from that paste. Duplicate questions, empty answers and oversized content block saving. Limits: 500 cards per deck, 5,000 characters per question, 20,000 per answer, 2,000 per reference, and 750 KB for the complete save request. Split a larger collection into multiple topic decks. Preview editing is paginated in groups of 10 cards.

## Storage and access

Decks use the dedicated Firestore collection `portal_flashcard_decks`. No seed content or database migration is required. Admin APIs verify the Firebase token and admin role; student APIs verify portal access and return only published decks. Lists select deck metadata, and the full deck is loaded when opened. Server routes use Firebase Admin, so these routes require no new client Firestore rules.

## AI chat

Chat uses the existing Groq integration. Configure `GROQ_API_KEY` alongside the existing Firebase public and admin environment variables. `GROQ_MODEL` optionally overrides the default model. Requests now require authenticated portal access, validate messages, time out, and return readable configuration/provider errors. MCQ mode requests five answer options. The chat has portal resource summaries, not full book contents or live legal research.

Run `npm run test:flashcards` for parser, API access/validation and mocked chat tests; `npx tsc --noEmit` for type checking. Live saving, publishing and AI replies must also be checked with configured Firebase/Groq credentials and an authorised account. Mocked provider tests do not establish live provider availability or legal answer accuracy.
