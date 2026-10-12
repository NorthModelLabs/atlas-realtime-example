import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const raw = fs.readFileSync(new URL('../app/lib/anime-start.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(raw, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const id = `ae1.${'a'.repeat(24)}.${'B'.repeat(43)}`;
function setup(fetch) {
  const context = vm.createContext({ exports: {}, fetch, FormData, File, AbortController,
    Date, setTimeout(fn) { queueMicrotask(fn); return 1; }, clearTimeout() {} });
  vm.runInContext(javascript, context); return context.exports.startAnimeSession;
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const image = () => new File(['LOCAL_FAUX_PORTRAIT_BYTES'], 'face.png', { type: 'image/png' });
test('actual client enrolls once, polls exact handle, starts only after ready', async () => {
  const calls = []; const progress = [];
  const start = setup(async (path, options) => {
    calls.push([path, options?.method || 'GET']);
    if (path === '/api/anime/enrollment') return response({ enrollment_id: id, status: 'queued', realtime_ready: false }, 202);
    if (options?.method === 'POST') return response({ session_id: 'ses_' + 'a'.repeat(20), livekit_url: 'wss://LOCAL_ONLY', token: 'LOCAL_FAUX_NONAUTH' });
    return response({ enrollment_id: id, status: 'completed', realtime_ready: true });
  });
  const result = await start(image(), value => progress.push(value), new AbortController().signal);
  assert.equal(result.session_id, 'ses_' + 'a'.repeat(20));
  assert.deepEqual(calls, [['/api/anime/enrollment', 'POST'], [`/api/anime/enrollment/${id}`, 'GET'], [`/api/anime/enrollment/${id}`, 'POST']]);
  assert.match(progress[0], /may be billable/);
});
test('failed/foreign enrollment cannot create a session', async () => {
  for (const result of [{ enrollment_id: id, status: 'failed', realtime_ready: false }, { enrollment_id: 'bad', realtime_ready: true }]) {
    let calls = 0; const start = setup(async () => { calls++; return response(result); });
    await assert.rejects(start(image(), () => {}, new AbortController().signal)); assert.equal(calls, 1);
  }
});
test('cancelled enrollment wait never creates a room or resubmits the portrait', async () => {
  let calls = 0; const controller = new AbortController();
  const start = setup(async () => { calls++; controller.abort(); return response({ enrollment_id: id, status: 'queued', realtime_ready: false }); });
  await assert.rejects(start(image(), () => {}, controller.signal)); assert.equal(calls, 1);
});
test('non-JSON and FastAPI detail strings do not trigger another POST', async () => {
  for (const result of [new Response('not json', { status: 503 }), response({ detail: 'Enrollment unavailable' }, 503)]) {
    let calls = 0; const start = setup(async () => { calls++; return result; });
    await assert.rejects(start(image(), () => {}, new AbortController().signal)); assert.equal(calls, 1);
  }
});
