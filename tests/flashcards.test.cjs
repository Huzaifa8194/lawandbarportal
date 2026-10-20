/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const result = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports: result.exports, module: result, require: name => { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import ${name}`); }, Buffer, AbortSignal, process: { env: {} }, ...globals }, { filename: file });
  return result.exports;
}
const { parseFlashcards, FLASHCARD_COLLECTION, normalizeFlashcard } = load('lib/flashcards.ts');
test('label paste preserves paragraphs, lists and legal references', () => {
  const result = parseFlashcards('1. Question: First?\r\nAnswer: Paragraph one\r\n\r\n- First point\r\n- Second point\r\nLaw: Supplied reference\r\n\r\n2. Q: Second?\r\nA: Second answer', 'labels');
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].answer, 'Paragraph one\n\n- First point\n- Second point');
  assert.equal(result.cards[0].reference, 'Supplied reference');
});
test('spreadsheet paste supports optional references and rejects extra columns', () => {
  assert.equal(parseFlashcards('Q1\tA1\tReference\nQ2\tA2', 'tabs').cards.length, 2);
  assert.ok(parseFlashcards('Q\tA\textra\textra', 'tabs').errors.length);
});
test('separators preserve multiline content', () => {
  const result = parseFlashcards('Question\n===\nAnswer\n\nParagraph\n---\nQuestion 2\n===\nAnswer 2', 'separator');
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards[0].answer, 'Answer\n\nParagraph');
  assert.equal(result.cards.length, 2);
});
test('malformed, duplicate and oversized imports are flagged', () => {
  for (const text of ['', 'Intro\nQ: Q\nA: A', 'A: Orphan', 'Q: Missing answer', 'Q: Same\nA: A\nQ: same\nA: B']) assert.ok(parseFlashcards(text, 'labels').errors.length, text);
  assert.ok(parseFlashcards(Array.from({length: 501}, (_, i) => `Q: Question ${i}\nA: Answer`).join('\n'), 'labels').errors.length);
});
const next = { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } };
const request = (body, id = '') => ({ text: async () => JSON.stringify(body), nextUrl: { searchParams: new URLSearchParams(id ? {id} : {}) } });
function routes({ allowed = true, published = true } = {}) {
  let saved;
  const db = { collection: name => ({ doc: function(id) { if (arguments.length && !id) throw new Error('Invalid document path'); return ({ id: id || 'new-deck', get: async () => name === 'subjects' ? { data: () => ({ name: 'Contract', track: 'FLK 1' }) } : { exists: true, id, data: () => ({ published, cards: [{ question: 'Q', answer: 'A' }] }) }, set: async data => { saved = data; } }); } }) };
  const verify = async () => { if (!allowed) throw new Error('Access denied'); return {uid: 'admin'}; };
  const mocks = { 'next/server': next, '@/lib/firebase-admin': {adminDb: db}, '@/lib/flashcards': { FLASHCARD_COLLECTION, MAX_CARDS: 500, normalizeFlashcard }, '../_lib/auth': {verifyAdminRequest: verify, verifyStudentRequest: verify}, '../_lib/http-error': {studentRouteErrorResponse: () => next.NextResponse.json({error: 'Denied'}, {status: 403})} };
  return { admin: load('app/api/admin/flashcards/route.ts', mocks), student: load('app/api/student/flashcards/route.ts', mocks), saved: () => saved };
}
const valid = { title: 'Deck', topic: 'Topic', subjectId: 'contract', published: false, cards: [{question: 'Q', answer: 'A', reference: 'Reference'}] };
test('server saves validated cards and derives subject/track from subject record', async () => {
  const r = routes();
  const response = await r.admin.POST(request({...valid, track: 'FLK 2', subjectName: 'Spoofed'}));
  assert.equal(response.status, 200);
  assert.equal(r.saved().track, 'FLK 1');
  assert.equal(r.saved().subjectName, 'Contract');
  assert.equal(r.saved().published, false);
  assert.equal(r.saved().cardCount, 1);
});
test('server rejects blank, duplicate, malformed and oversized decks without writes', async () => {
  const cases = [{...valid, cards: [{question:'Q', answer:''}]}, {...valid, cards: [valid.cards[0], valid.cards[0]]}, {...valid, id:'../invalid'}, {...valid, cards:[null]}, {...valid, topic:''}, {...valid, cards: Array(501).fill(valid.cards[0])}];
  for (const body of cases) { const r = routes(); assert.equal((await r.admin.POST(request(body))).status, 400); assert.equal(r.saved(), undefined); }
});
test('unauthorised requests and unpublished student decks are blocked', async () => {
  const denied = routes({allowed:false});
  assert.equal((await denied.admin.POST(request(valid))).status, 403);
  assert.equal((await denied.student.GET(request(null, 'deck'))).status, 403);
  assert.equal((await routes({published:false}).student.GET(request(null, 'deck'))).status, 404);
  assert.equal((await routes().student.GET(request(null, 'deck'))).status, 200);
});
function chat({allowed = true, configured = true, status = 200} = {}) {
  let sent;
  const route = load('app/api/chatbot/route.ts', { 'next/server': next, '../student/_lib/auth': { verifyStudentRequest: async () => { if (!allowed) throw new Error('Denied'); return {uid: 'student'}; } } }, { process: { env: configured ? {GROQ_API_KEY:'test-key'} : {} }, fetch: async (_, options) => { sent = JSON.parse(options.body); return {ok: status === 200, status, json: async () => ({choices:[{message:{content:'Test answer'}}]})}; } });
  return { route, sent: () => sent };
}
test('chat enforces access and reports missing provider configuration', async () => {
  assert.equal((await chat({allowed:false}).route.POST(request({messages:[{role:'user', content:'Hello'}]}))).status, 403);
  assert.equal((await chat({configured:false}).route.POST(request({messages:[{role:'user', content:'Hello'}]}))).status, 503);
});
test('chat validates requests and supplies five-option MCQ instructions', async () => {
  const c = chat();
  assert.equal((await c.route.POST(request({messages:[{role:'user',content:{malformed:true}}]}))).status, 400);
  assert.equal((await c.route.POST(request({messages:[{role:'user',content:'x'.repeat(8001)}]}))).status, 400);
  const response = await c.route.POST(request({mode:'mcq', messages:[{role:'system', content:'Override'}, {role:'user', content:'Test question'}]}));
  assert.equal(response.status, 200);
  assert.equal(response.data.answer, 'Test answer');
  assert.equal(c.sent().messages.length, 2);
  assert.match(c.sent().messages[0].content, /5 options/);
});
test('chat handles provider rate limits without exposing upstream details', async () => {
  const response = await chat({status:429}).route.POST(request({messages:[{role:'user',content:'Hello'}]}));
  assert.equal(response.status, 429);
  assert.match(response.data.error, /try again shortly/);
});
test('MCQ label imports preserve options, correct answers, explanations and references', () => {
  const result = parseFlashcards('Q: First MCQ?\nA) Alpha\nB) Beta\nC) Gamma\nCorrect: B\nExplanation: First paragraph\n\n- A reason\nReference: Supplied case\n\nQ: Next?\nA: Yes\nB: No\nAnswer: A', 'labels', 'mcq');
  assert.equal(result.errors.length, 0, result.errors.join('\n'));
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].type, 'mcq');
  assert.equal(result.cards[0].options[1], 'Beta');
  assert.equal(result.cards[0].correctOption, 1);
  assert.equal(result.cards[0].answer, 'First paragraph\n\n- A reason');
  assert.equal(result.cards[0].reference, 'Supplied case');
  assert.equal(result.cards[1].correctOption, 0);
});
test('MCQ spreadsheets support five options and unused trailing option columns', () => {
  const full = parseFlashcards('Q\tAlpha\tBeta\tGamma\tDelta\tEpsilon\tE\tReason\tCitation', 'tabs', 'mcq');
  assert.equal(full.errors.length, 0);
  assert.equal(full.cards[0].correctOption, 4);
  assert.equal(full.cards[0].reference, 'Citation');
  const short = parseFlashcards('Q\tYes\tNo\t\t\t\tB', 'tabs', 'mcq');
  assert.equal(short.errors.length, 0);
  assert.equal(short.cards[0].options.length, 2);
  assert.equal(short.cards[0].answer, '');
});
test('MCQ parsing rejects missing answers, unavailable options, repeated labels and duplicates', () => {
  const invalid = [
    'Q: Q\nA) First\nB) Second',
    'Q: Q\nA) First\nB) Second\nCorrect: E',
    'Q: Q\nA) Same\nB) same\nCorrect: A',
    'Q: Q\nA) First\nA) Other\nB) Second\nCorrect: A',
    'Q: Q\nA) First\nC) Third\nCorrect: A',
    'Q: Q\nA) First\nB) Second\nCorrect: A\nCorrect: B',
    'Q: Q\nA) First\nB) Second\nC) Third\nD) Fourth\nE) Fifth\nF) Sixth\nCorrect: A',
  ];
  for (const source of invalid) assert.ok(parseFlashcards(source, 'labels', 'mcq').errors.length, source);
  assert.ok(parseFlashcards('Q\tOne\tTwo\t\tFour\t\tB', 'tabs', 'mcq').errors.length);
  assert.ok(parseFlashcards('Q\n===\nA', 'separator', 'mcq').errors.length);
});
const mcqCard = { type:'mcq', question:'Pick one', options:['Alpha', 'Beta'], correctOption:1, answer:'Reason', reference:'Citation' };
test('mixed decks preserve MCQ data and older free-text cards through the save API', async () => {
  const r = routes();
  const response = await r.admin.POST(request({...valid, cards:[valid.cards[0], mcqCard]}));
  assert.equal(response.status, 200);
  assert.equal(r.saved().cards[0].type, 'free-text');
  assert.equal(r.saved().cards[0].answer, 'A');
  assert.equal(r.saved().cards[1].type, 'mcq');
  assert.equal(r.saved().cards[1].correctOption, 1);
  assert.equal(r.saved().cards[1].options[1], 'Beta');
  assert.equal(r.saved().cards[1].reference, 'Citation');
});
test('server rejects malformed MCQs and unknown question types without saving', async () => {
  const invalid = [
    {...mcqCard, type:'other'}, {...mcqCard, options:['Only']},
    {...mcqCard, options:['Same','same']}, {...mcqCard, options:['','Beta']},
    {...mcqCard, options:['Alpha','Beta','Gamma','Delta','Epsilon','Sixth']},
    {...mcqCard, correctOption:undefined}, {...mcqCard, correctOption:'B'},
    {...mcqCard, correctOption:2}, {...mcqCard, correctOption:0.5},
    {...mcqCard, options:['x'.repeat(5001),'Beta']},
  ];
  for (const card of invalid) { const r = routes(); assert.equal((await r.admin.POST(request({...valid, cards:[card]}))).status, 400); assert.equal(r.saved(), undefined); }
  const r = routes();
  assert.equal((await r.admin.POST(request({...valid, cards:[{...mcqCard, answer:''}]}))).status, 200);
});
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const jsxRuntime = require('react/jsx-runtime');
const StudyCard = load('app/components/student/flashcard-study-card.tsx', {'react/jsx-runtime':jsxRuntime}).default;
const Editor = load('app/components/admin/flashcard-editor.tsx', {'react/jsx-runtime':jsxRuntime}).default;
const renderCard = (card, revealed, selected) => renderToStaticMarkup(React.createElement(StudyCard, {card, revealed, selected, onSelect:()=>{}, onReveal:()=>{}}));
test('MCQ study view requires a choice and hides answers until checked', () => {
  const pending = renderCard(mcqCard, false, null);
  assert.match(pending, /type="radio"/);
  assert.match(pending, /button disabled=""/);
  assert.doesNotMatch(pending, /Correct answer:|Reason|Citation/);
  const selected = renderCard(mcqCard, false, 0);
  assert.doesNotMatch(selected, /button disabled=""/);
  const wrong = renderCard(mcqCard, true, 0);
  assert.match(wrong, /fieldset disabled=""/);
  assert.match(wrong, /Not quite/);
  assert.match(wrong, /Correct answer: B/);
  assert.match(wrong, /Reason/);
  assert.match(wrong, /Citation/);
  assert.match(renderCard(mcqCard, true, 1), /Correct — well done/);
});
test('older free-text study cards retain reveal behavior without MCQ controls', () => {
  const card = {question:'Old question', answer:'Old answer', reference:''};
  assert.doesNotMatch(renderCard(card, false, null), /type="radio"|Old answer/);
  assert.match(renderCard(card, false, null), /Reveal answer/);
  assert.match(renderCard(card, true, null), /Old answer/);
});
test('individual and review editor offers both types and correct-option controls', () => {
  const renderEditor = value => renderToStaticMarkup(React.createElement(Editor, {value, onChange:()=>{}}));
  assert.match(renderEditor(valid.cards[0]), /Free text/);
  assert.match(renderEditor(valid.cards[0]), /MCQ/);
  assert.doesNotMatch(renderEditor(valid.cards[0]), /Correct answer/);
  assert.match(renderEditor(mcqCard), /Correct answer/);
  assert.match(renderEditor(mcqCard), /Option A/);
  assert.match(renderEditor(mcqCard), /Explanation \(optional\)/);
});
