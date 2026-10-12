import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const handle = `ae1.${'a'.repeat(24)}.${'B'.repeat(43)}`;
function compiled(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}
function context(path, upstream, { disabled = false, denied = false } = {}) {
  const grants = []; let requests = 0;
  const sandbox = vm.createContext({ exports: {}, Blob, FormData, Buffer,
    require(name) {
      if (name === 'node:crypto') return require(name);
      if (name === 'next/server') return { NextResponse: { json(value, options) { return new Response(JSON.stringify(value), options); } } };
      if (name === '@/app/lib/demo-access') return {
        creationGuard() { return denied ? new Response('denied', { status: 403 }) : null; },
        accessGuard() { return denied ? new Response('denied', { status: 403 }) : null; },
        grant(response, kind, id) { grants.push([kind, id]); return response; },
      };
      if (name === '@/app/lib/anime-enrollment.server') return {
        animeEnabled: () => !disabled, ENROLLMENT_ID: /^ae1\.[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/,
        SESSION_ID: /^ses_[a-f0-9]{20}$/, FACE_TYPES: new Set(['image/png', 'image/jpeg', 'image/webp']),
        async animeUpstream(...args) { requests++; return upstream(...args); },
      };
      throw new Error('unexpected dependency');
    },
  });
  vm.runInContext(compiled(path), sandbox);
  return { route: sandbox.exports, grants, requests: () => requests };
}
const params = { params: Promise.resolve({ id: handle }) };
const request = () => {
  const body = new FormData(); body.append('face', new Blob(['LOCAL_FAUX_NONAUTH'], { type: 'image/png' }));
  return { headers: new Headers({ 'content-type': 'multipart/form-data' }), formData: async () => body };
};
test('actual enrollment handler guard/OFF cannot send an upstream request', async () => {
  for (const options of [{ disabled: true }, { denied: true }]) {
    const s = context('../app/api/anime/enrollment/route.ts', () => assert.fail('no upstream'), options);
    assert.equal((await s.route.POST(request())).status, options.denied ? 403 : 404);
    assert.equal(s.requests(), 0); assert.equal(s.grants.length, 0);
  }
});
test('actual enrollment handler binds content-key and grants only exact authenticated handle', async () => {
  const s = context('../app/api/anime/enrollment/route.ts', async (path, options) => {
    assert.equal(path, '/v1/realtime/anime/enrollments'); assert.equal(options.method, 'POST');
    assert.match(options.headers['Idempotency-Key'], /^demo-anime-v1-[a-f0-9]{64}$/);
    assert.equal(await options.body.get('face').text(), 'LOCAL_FAUX_NONAUTH');
    return { ok: true, status: 202, data: { enrollment_id: handle, status: 'queued', realtime_ready: false } };
  });
  assert.equal((await s.route.POST(request())).status, 202);
  assert.deepEqual(s.grants[0], ['anime_enrollment', handle]); assert.equal(s.requests(), 1);
});
test('actual start handler refuses absent readiness and foreign browser before session POST', async () => {
  const s = context('../app/api/anime/enrollment/[id]/route.ts', async () => ({ ok: true, status: 200, data: { enrollment_id: handle, realtime_ready: false } }));
  assert.equal((await s.route.POST({}, params)).status, 409); assert.equal(s.requests(), 1);
  const denied = context('../app/api/anime/enrollment/[id]/route.ts', () => assert.fail('no upstream'), { denied: true });
  assert.equal((await denied.route.POST({}, params)).status, 403); assert.equal(denied.requests(), 0);
});
test('actual ready handler uses only accepted anime route and same session capability lifecycle', async () => {
  const calls = [], id = 'ses_' + 'a'.repeat(20);
  const s = context('../app/api/anime/enrollment/[id]/route.ts', async (path, options) => {
    calls.push(path);
    if (!options) return { ok: true, status: 200, data: { enrollment_id: handle, realtime_ready: true } };
    assert.deepEqual(JSON.parse(options.body), { mode: 'passthrough', mouth_mode: 'anime_realtime', anime_enrollment_id: handle });
    return { ok: true, status: 200, data: { session_id: id, livekit_url: 'wss://LOCAL_ONLY', token: 'LOCAL_FAUX_NONAUTH' } };
  });
  assert.equal((await s.route.POST({}, params)).status, 200); assert.equal(calls.length, 2);
  assert.deepEqual(s.grants[0], ['session', id]);
});
test('actual capability grant scopes dotted enrollment separately and leaves session paths unchanged', () => {
  const cookies = [], response = { cookies: { set(...args) { cookies.push(args); } } };
  const sandbox = vm.createContext({ exports: {}, process: { env: { DEMO_ACCESS_SECRET: 'LOCAL_ONLY'.repeat(8) } },
    require(name) { if (name === './demo-capability.mjs') return { token: () => 'LOCAL_FAUX_NONAUTH', valid: () => false }; if (name === 'next/server') return {}; throw new Error('unexpected'); } });
  vm.runInContext(compiled('../app/lib/demo-access.ts'), sandbox);
  sandbox.exports.grant(response, 'anime_enrollment', handle);
  assert.equal(cookies[0][2].path, `/api/anime/enrollment/${handle}`);
  sandbox.exports.grant(response, 'session', 'ses_' + 'a'.repeat(20));
  assert.equal(cookies[1][2].path, '/api/session/ses_' + 'a'.repeat(20));
  assert.throws(() => sandbox.exports.grant(response, 'session', handle));
  assert.throws(() => sandbox.exports.grant(response, 'anime_enrollment', 'ses_' + 'a'.repeat(20)));
});
