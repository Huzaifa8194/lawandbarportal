/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Readable } = require('node:stream');
const ts = require('typescript');
const file = 'app/api/student/books/[bookId]/file/route.ts';
function route({ storage = () => Readable.from([Buffer.from('%PDF-1.7\nbook')]), fetcher, denied = false, published = true } = {}) {
  const buckets = [];
  class NextResponse extends Response {
    static json(data, options) { return new NextResponse(JSON.stringify(data), options); }
  }
  const mocks = {
    'node:stream': { Readable },
    'next/server': { NextResponse },
    '../../../_lib/auth': { verifyStudentRequest: async () => { if (denied) throw new Error('Access denied'); } },
    '../../../_lib/http-error': { studentRouteErrorResponse: () => NextResponse.json({error: 'Access denied'}, {status: 403}) },
    '@/lib/portal-collections': { PORTAL_BOOKS_COLLECTION: 'books' },
    '@/lib/firebase-admin': {
      adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ published, filePath: 'books/a.pdf', fileUrl: 'https://example.test/a.pdf', title: '法律' }) }) }) }) },
      adminStorage: { bucket: name => { buckets.push(name); return { file: () => ({ createReadStream: storage }) }; } },
    },
  };
  const result = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: result.exports, module: result, require: name => mocks[name], Buffer, Headers, ReadableStream, Uint8Array, AbortSignal, console: {error() {}}, process: {env: { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'configured-bucket' }}, fetch: fetcher });
  return { get: () => result.exports.GET({ signal: new AbortController().signal }, {params: Promise.resolve({bookId: 'book'})}), buckets };
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
  assert.equal((await r.get()).status, 502);
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

