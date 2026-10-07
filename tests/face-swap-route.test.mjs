import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../app/api/session/[id]/route.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function setup(fetch, deny = false) {
  let expire, cleared = false, guards = 0;
  const context = vm.createContext({ exports: {}, Blob, FormData, AbortController,
    process: { env: { ATLAS_API_URL: 'https://synthetic.invalid', ATLAS_API_KEY: 'synthetic-test-key' } }, fetch,
    setTimeout(fn, delay) { assert.equal(delay, 30000); expire = fn; return 1; },
    clearTimeout(id) { assert.equal(id, 1); cleared = true; },
    require(name) {
      if (name === '@/app/lib/demo-access') return { accessGuard() { guards++; return deny ? new Response('denied', { status: 403 }) : null; } };
      if (name === 'next/server') return { NextResponse: { json(data, options) { return new Response(JSON.stringify(data), options); } } };
      throw new Error(`Unexpected module ${name}`);
    },
  });
  vm.runInContext(javascript, context);
  const form = new FormData(); form.append('face', new Blob(['portrait'], { type: 'image/png' }));
  return { context, req: { formData: async () => form }, params: { params: Promise.resolve({ id: 'ses_0123456789abcdefabcd' }) },
    expire() { expire(); }, cleared: () => cleared, guards: () => guards };
}
test('guarded face update preserves multipart bytes, API response and timer cleanup', async () => {
  let calls = 0;
  const s = setup(async (url, options) => {
    calls++; assert.equal(url, 'https://synthetic.invalid/v1/realtime/session/ses_0123456789abcdefabcd');
    assert.equal(options.method, 'PATCH'); assert.equal(await options.body.get('face').text(), 'portrait');
    assert.equal(options.signal.aborted, false);
    return new Response(JSON.stringify({ face_updated: true, metadata_pushed: false }), { status: 200 });
  });
  const result = await s.context.exports.PATCH(s.req, s.params);
  assert.equal(result.status, 200); assert.equal((await result.json()).metadata_pushed, false);
  assert.equal(calls, 1); assert.equal(s.guards(), 1); assert.equal(s.cleared(), true);
});
test('upstream timeout is bounded, reports ambiguity and never retries', async () => {
  let calls = 0, started;
  const ready = new Promise(resolve => { started = resolve; });
  const s = setup((url, options) => {
    calls++; started();
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
  });
  const pending = s.context.exports.PATCH(s.req, s.params);
  await ready; s.expire(); const result = await pending;
  assert.equal(result.status, 504); assert.match((await result.json()).message, /may already have reached/);
  assert.equal(calls, 1); assert.equal(s.cleared(), true);
});
test('timeout covers delayed response-body parsing as well as HTTP headers', async () => {
  let signal, parsing;
  const ready = new Promise(resolve => { parsing = resolve; });
  const s = setup(async (_, options) => {
    signal = options.signal;
    return { status: 200, json() { parsing(); return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abort')), { once: true })); } };
  });
  const pending = s.context.exports.PATCH(s.req, s.params); await ready; s.expire();
  assert.equal((await pending).status, 504); assert.equal(s.cleared(), true);
});
test('unauthorized update never sends an upstream request or creates a timer', async () => {
  const s = setup(() => { throw new Error('must not send'); }, true);
  assert.equal((await s.context.exports.PATCH(s.req, s.params)).status, 403);
  assert.equal(s.guards(), 1); assert.equal(s.cleared(), false);
});
