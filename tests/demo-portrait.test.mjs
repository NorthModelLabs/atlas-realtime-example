import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const compiled = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function contract() {
  const box = { exports: {}, Blob, Response, TextDecoder };vm.runInNewContext(compiled('../app/lib/demo-portrait.ts'), box);return box.exports;
}
function createRoute({ denied = false } = {}) {
  let requests = 0;const grants = [];
  const box = { exports: {}, Blob, FormData,
    process: { env: { ATLAS_API_URL: 'https://LOCAL_ONLY.invalid', ATLAS_API_KEY: 'LOCAL_FAUX_NONAUTH', ATLAS_MODEL_VARIANT: 'test5' } },
    fetch: async (url, options) => {
      requests++;assert.equal(options.headers['X-Model-Variant'], 'test5');
      if (typeof options.body === 'string') assert.deepEqual(JSON.parse(options.body), { mode: 'passthrough' });
      else { assert.equal(await options.body.get('face').text(), 'LOCAL_FAUX_PORTRAIT');assert.equal(options.body.get('mode'), 'passthrough'); }
      return new Response(JSON.stringify({ session_id: 'ses_' + 'a'.repeat(20) }), { status: 200 });
    },
    require(name) {
      if (name === '@/app/lib/demo-portrait') return contract();
      if (name === '@/app/lib/demo-access') return {
        creationGuard: () => denied ? new Response('denied', { status: 403 }) : null,
        grant: (response, kind, id) => { grants.push([kind, id]);return response; },
      };
      if (name === 'next/server') return { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), options) } };
      throw new Error('Unexpected module');
    },
  };
  vm.runInNewContext(compiled('../app/api/session/route.ts'), box);
  return { post: box.exports.POST, requests: () => requests, grants };
}
function request(bytes = 'LOCAL_FAUX_PORTRAIT') {
  const body = new FormData();body.append('face', new Blob([bytes], { type: 'image/png' }));body.append('mode', 'passthrough');
  return new Request('https://demo.invalid/api/session', { method: 'POST', body });
}

test('shared portrait contract has no environment dependency and respects exact 4 MB', () => {
  const c = contract();assert.equal(c.PORTRAIT_MAX_BYTES, 4_000_000);assert.equal(c.MULTIPART_MAX_BYTES, 4_250_000);
  assert.equal(c.portraitError(new Blob([new Uint8Array(4_000_000)], { type: 'image/png' })), null);
  assert.match(c.portraitError(new Blob([new Uint8Array(4_000_001)], { type: 'image/png' })), /4 MB/);
  assert.doesNotMatch(fs.readFileSync(new URL('../app/lib/demo-portrait.ts', import.meta.url), 'utf8'), /process\.env|\.server/);
});
test('actual JSON proxy refuses every face_url presence and non-object before upstream', async () => {
  for (const body of [null, [], false, 3, 'text', ...[null, '', 'https://managed.invalid/face', 'https://public.invalid/face'].map(face_url => ({ face_url, mode: 'passthrough' }))]) {
    const route = createRoute();const req = new Request('https://demo.invalid/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await route.post(req)).status, 400);assert.equal(route.requests(), 0);assert.equal(route.grants.length, 0);
  }
  const route = createRoute();assert.equal((await route.post(new Request('https://demo.invalid/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"mode":"passthrough"}' }))).status, 200);
  assert.equal(route.requests(), 1);
});
test('JSON malformed/oversize never silently falls back to a default portrait', async () => {
  for (const [body, status] of [['{broken', 400], [' '.repeat(16385), 413]]) {
    const route = createRoute();assert.equal((await route.post(new Request('https://demo.invalid/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))).status, status);
    assert.equal(route.requests(), 0);
  }
});
test('actual human creation preserves test5, mode, bytes and session capability', async () => {
  const route = createRoute();assert.equal((await route.post(request())).status, 200);
  assert.equal(route.requests(), 1);assert.deepEqual(route.grants, [['session', 'ses_' + 'a'.repeat(20)]]);
});
test('human creation oversize and denied origin cannot submit an upstream POST', async () => {
  const large = createRoute();assert.equal((await large.post(request(new Uint8Array(4_000_001)))).status, 413);
  assert.equal(large.requests(), 0);assert.equal(large.grants.length, 0);
  const denied = createRoute({ denied: true });assert.equal((await denied.post(request())).status, 403);assert.equal(denied.requests(), 0);
});
test('stream cap works without Content-Length and keeps bound failure if cancel fails', async () => {
  const c = contract();let cancelled = 0;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4_250_001)); },
    cancel() { cancelled++;throw new Error('LOCAL_FAUX_CANCEL'); } });
  await assert.rejects(c.portraitForm({ headers: new Headers({ 'Content-Type': 'multipart/form-data; boundary=x' }), body }), error =>
    error instanceof c.PortraitInputError && error.status === 413);
  assert.equal(cancelled, 1);
});
test('duplicate and unsupported multipart fields cannot reach human creation', async () => {
  for (const extra of ['face', 'unsupported']) {
    const route = createRoute();const body = new FormData();body.append('face', new Blob(['a'], { type: 'image/png' }));body.append(extra, 'b');
    assert.equal((await route.post(new Request('https://demo.invalid/api/session', { method: 'POST', body }))).status, 400);
    assert.equal(route.requests(), 0);
  }
});
