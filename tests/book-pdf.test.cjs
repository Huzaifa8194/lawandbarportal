/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const result = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: result.exports, module: result, require: name => { if (!(name in mocks)) throw new Error(`Unexpected import ${name}`); return mocks[name]; }, Error, TypeError, Buffer, Headers, ReadableStream, Uint8Array, AbortSignal, setTimeout, clearTimeout, URL, console: {error() {}, warn() {}}, process: {env: { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'configured-bucket' }}, ...globals });
  return result.exports;
}
const errors = load('lib/pdf-errors.ts');
const file = 'app/api/student/books/[bookId]/file/route.ts';
function route({ storage = () => Readable.from([Buffer.from('%PDF-1.7\nbook')]), fetcher, denied = false, published = true, fileUrl = "https://example.test/a.pdf", metadataError, authError } = {}) {
  const buckets = [];
  class NextResponse extends Response {
    static json(data, options) { return new NextResponse(JSON.stringify(data), options); }
  }
  const mocks = {
    'node:stream': { Readable },
    'node:crypto': { randomUUID: () => 'test-request-id' },
    '@/lib/pdf-errors': errors,
    'next/server': { NextResponse },
    '../../../_lib/auth': { verifyStudentRequest: async () => { if (authError) throw authError; if (denied) throw new Error('Access denied'); } },
    '../../../_lib/http-error': { studentRouteErrorResponse: () => NextResponse.json({error: 'Access denied'}, {status: 403}) },
    '@/lib/portal-collections': { PORTAL_BOOKS_COLLECTION: 'books' },
    '@/lib/firebase-admin': {
      adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ published, filePath: 'books/a.pdf', fileUrl, title: '法律' }) }) }) }) },
      adminStorage: { bucket: name => { buckets.push(name); return { file: () => ({ createReadStream: storage, getMetadata: async () => { if (metadataError) throw metadataError; return [{metadata: {firebaseStorageDownloadTokens: 'fresh-token'}}]; } }) }; } },
    },
  };
  const module = load(file, mocks, {fetch: fetcher});
  return { get: (source = false) => module.GET({ signal: new AbortController().signal, nextUrl: new URL(source ? 'https://portal.test/file?source=1' : 'https://portal.test/file') }, {params: Promise.resolve({bookId: 'book'})}), buckets };
}
test('streams from the explicit configured bucket and encodes Unicode filenames', async () => {
  const r = route();
  const response = await r.get();
  assert.equal(response.status, 200);
  assert.deepEqual(r.buckets, ['configured-bucket']);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''%/);
  assert.equal(await response.text(), '%PDF-1.7\nbook');
});
test('falls back to streamed legacy URL after storage failure', async () => {
  const r = route({ storage: () => Readable.from((async function* () { throw new Error('not found'); })()), fetcher: async () => new Response('%PDF-legacy') });
  assert.equal(await (await r.get()).text(), '%PDF-legacy');
});
test('rejects HTML instead of passing it to the viewer', async () => {
  const r = route({ storage: () => Readable.from([Buffer.from('<html>error')]), fetcher: async () => new Response('<html>error') });
  assert.equal((await r.get()).status, 422);
});
test('validates PDF signatures split across stream chunks', async () => {
  const r = route({ storage: () => Readable.from([Buffer.from('%P'), Buffer.from('DF-1.7')]) });
  assert.equal(await (await r.get()).text(), '%PDF-1.7');
});
test('denied and unpublished books never open storage', async () => {
  for (const options of [{denied: true}, {published: false}]) {
    const r = route(options);
    assert.equal((await r.get()).status, options.denied ? 403 : 404);
    assert.equal(r.buckets.length, 0);
  }
});
test('client disconnect destroys the source stream', async () => {
  const source = new Readable({read() { this.push('%PDF-'); this._read = () => {}; }});
  const r = route({storage: () => source});
  const response = await r.get();
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(source.destroyed, true);
});


test('source uses bucket and object encoded in Firebase URL and refreshes stale tokens', async () => {
  const r = route({fileUrl: 'https://firebasestorage.googleapis.com/v0/b/actual-bucket/o/books%2Fa.pdf?alt=media&token=stale'});
  const response = await r.get(true);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(r.buckets[0], 'actual-bucket');
  assert.match(payload.url, /token=fresh-token/);
  assert.equal(payload.requestId, 'test-request-id');
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('missing storage files return a diagnostic with reference and do not retry', async () => {
  const r = route({metadataError: {code: 404}});
  const response = await r.get(true);
  const error = await response.json();
  assert.equal(response.status, 404);
  assert.equal(error.code, 'PDF_FILE_MISSING');
  assert.equal(error.retryable, false);
  assert.equal(error.requestId, 'test-request-id');
});
test('expired Firebase token is 401, not a server or permission error', async () => {
  const r = route({authError: {code: 'auth/id-token-expired'}});
  const response = await r.get(true);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'PDF_SESSION_EXPIRED');
});
function downloader(fetcher) {
  return load('lib/services/pdf-download.ts', {'@/lib/pdf-errors': errors}, {fetch: fetcher, Blob}).downloadBookPdf;
}
test('direct storage downloads report progress and avoid the proxy', async () => {
  const calls = [], progress = [];
  const download = downloader(async url => {
    calls.push(url);
    return String(url).includes('?source=1') ? Response.json({url: 'https://storage.test/book'}) : new Response('%PDF-book', {headers: {'Content-Length': '9'}});
  });
  const blob = await download('book', async () => 'token', new AbortController().signal, p => progress.push(p));
  assert.equal(await blob.text(), '%PDF-book');
  assert.equal(calls.length, 2);
  assert.equal(progress.at(-1).received, 9);
});
test('storage CORS/network failure falls back to authenticated proxy', async () => {
  const calls = [];
  const download = downloader(async (url, options) => {
    calls.push(url);
    if (String(url).includes('?source=1')) return Response.json({url: 'https://storage.test/book'});
    if (url === 'https://storage.test/book') throw new TypeError('Failed to fetch');
    assert.equal(options.headers.Authorization, 'Bearer token');
    return new Response('%PDF-fallback');
  });
  assert.equal(await (await download('book', async () => 'token', new AbortController().signal, () => {})).text(), '%PDF-fallback');
  assert.equal(calls.length, 3);
});
test('source network failure retries and refreshes the auth token', async () => {
  let attempts = 0; const refresh = [];
  const download = downloader(async () => { if (++attempts === 1) throw new TypeError('Failed to fetch'); if (attempts === 2) return Response.json({}); return new Response('%PDF-retry'); });
  const blob = await download('book', async force => {refresh.push(force); return 'token';}, new AbortController().signal, () => {});
  assert.equal(await blob.text(), '%PDF-retry');
  assert.deepEqual(refresh, [false, true]);
});
test('permission failures expose the server reference and do not retry', async () => {
  let calls = 0;
  const download = downloader(async () => { calls++; return Response.json({error: 'Access denied', code: 'PDF_ACCESS_DENIED', requestId: 'ref', retryable: false}, {status: 403}); });
  await assert.rejects(download('book', async () => 'token', new AbortController().signal, () => {}), e => e.code === 'PDF_ACCESS_DENIED' && e.requestId === 'ref' && e.status === 403);
  assert.equal(calls, 1);
});
test('invalid content is rejected with an actionable error', async () => {
  const download = downloader(async url => String(url).includes('?source=1') ? Response.json({}) : new Response('<html>gateway failure</html>'));
  await assert.rejects(download('book', async () => 'token', new AbortController().signal, () => {}), e => e.code === 'PDF_INVALID_FILE' && !e.retryable);
});
test('cancellation stops download retries', async () => {
  const controller = new AbortController(); let calls = 0;
  const download = downloader(async () => { calls++; controller.abort(); throw new TypeError('Failed to fetch'); });
  await assert.rejects(download('book', async () => 'token', controller.signal, () => {}));
  assert.equal(calls, 1);
});
const {restoreViewerAnnotations} = load('lib/pdf-annotations.ts');
test('legacy highlight positions migrate to PDF points without duplication', () => {
  const highlights = [{id: 'a', page: 1, color: 'yellow', text: 'saved text', rects: [{left: 10, top: 20, width: 30, height: 5}]}];
  const pages = [{size: {width: 600, height: 800}}];
  const items = restoreViewerAnnotations('', highlights, pages);
  assert.equal(items[0].annotation.rect.origin.x, 60);
  assert.equal(items[0].annotation.rect.origin.y, 160);
  assert.equal(items[0].annotation.segmentRects[0].size.width, 180);
  assert.equal(restoreViewerAnnotations(JSON.stringify(items), highlights, pages).length, 1);
  assert.equal(restoreViewerAnnotations(JSON.stringify(items), [], pages).length, 0);
});
