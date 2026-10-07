import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../app/demo.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('demo.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name) {
  let found;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      assert.ok(ts.isCallExpression(node.initializer));
      found = node.initializer.arguments[0].getText(tree);
    }
    ts.forEachChild(node, walk);
  }
  walk(tree); assert.ok(found, name);
  return ts.transpileModule(`globalThis.${name} = ${found};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function setup(fetch, connected = true) {
  const state = { id: 'old', preview: 'old.png', loading: false, swapping: false, messages: [], file: null };
  const readers = [];
  const context = vm.createContext({
    session: { sessionId: 'ses_0123456789abcdefabcd' }, isConnected: connected,
    faceSelectionVersionRef: { current: 0 }, faceSwapInFlightRef: { current: false },
    swapInputRef: { current: { value: 'chosen.png' } }, File, FormData, fetch,
    setFaceFile: x => { state.file = x; }, setSelectedFaceId: x => { state.id = x; },
    setFacePreview: x => { state.preview = x; }, setFaceUrl: () => {},
    setFaceLoading: x => { state.loading = x; }, setSwapping: x => { state.swapping = x; },
    addMsg: (_, x) => state.messages.push(x),
    FileReader: class { readAsDataURL(file) { readers.push(() => this.onload({ target: { result: `data:${file.name}` } })); } },
  });
  for (const name of ['handleFile', 'handleFileSelect', 'handleSwapFace', 'selectPresetFace'])
    vm.runInContext(callback(name), context);
  return { context, state, readers };
}
const preset = { id: 'reel', src: '/faces/reel-alt.png' };
const image = () => new Blob(['portrait'], { type: 'image/png' });
const ok = () => new Response(JSON.stringify({ face_updated: true, metadata_pushed: true }), { status: 200 });

test('connected preset completes loading, retains selected upload and supports next swap', async () => {
  const calls = [];
  const s = setup(async (url, options) => { calls.push({ url, options }); return options ? ok() : new Response(image()); });
  await s.context.selectPresetFace(preset);
  assert.equal(s.state.loading, false); assert.equal(s.state.swapping, false);
  assert.equal(s.state.id, 'reel'); assert.equal(s.state.file.name, 'reel.png');
  s.readers.shift()(); assert.equal(s.state.preview, 'data:reel.png');
  await s.context.selectPresetFace({ id: 'other', src: '/faces/default.png' });
  assert.equal(s.state.loading, false); assert.equal(s.state.id, 'other');
  assert.equal(calls.filter(x => x.options?.method === 'PATCH').length, 2);
});

test('metadata not delivered is not reported or previewed as a successful swap', async () => {
  const s = setup(async (_, options) => options
    ? new Response(JSON.stringify({ face_updated: true, metadata_pushed: false })) : new Response(image()));
  await s.context.selectPresetFace(preset);
  assert.equal(s.state.id, 'old'); assert.equal(s.state.preview, 'old.png');
  assert.equal(s.state.loading, false); assert.equal(s.state.swapping, false);
  assert.equal(s.readers.length, 0); assert.ok(s.state.messages[0].startsWith('Face swap failed:'));
});

test('missing/non-image preset is rejected before sending a session update', async () => {
  for (const response of [new Response('missing', { status: 404 }), new Response('<html>')]) {
    let patches = 0;
    const s = setup(async (_, options) => { if (options) patches++; return response; });
    await s.context.selectPresetFace(preset);
    assert.equal(patches, 0); assert.equal(s.state.id, 'old'); assert.equal(s.state.loading, false);
  }
});

test('overlapping in-flight session updates cannot overwrite newer selection', async () => {
  let release; let patches = 0;
  const s = setup(async (_, options) => {
    if (!options) return new Response(image());
    patches++; return new Promise(resolve => { release = resolve; });
  });
  const first = s.context.selectPresetFace(preset);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await s.context.selectPresetFace({ id: 'other', src: '/faces/default.png' });
  assert.equal(patches, 1); release(ok()); await first;
  assert.equal(s.state.id, 'reel'); assert.equal(s.state.loading, false);
});

test('slow old preset fetch and stale reader cannot replace latest local image', async () => {
  let release;
  const s = setup(() => new Promise(resolve => { release = resolve; }), false);
  const first = s.context.selectPresetFace(preset);
  s.context.handleFile(new File(['new'], 'new.png', { type: 'image/png' }));
  release(new Response(image())); await first;
  s.readers.shift()(); assert.equal(s.state.preview, 'data:new.png'); assert.equal(s.state.id, 'custom'); assert.equal(s.state.loading, false);
  s.context.handleFile(new File(['a'], 'a.png', { type: 'image/png' }));
  s.context.handleFile(new File(['b'], 'b.png', { type: 'image/png' }));
  s.readers.shift()(); s.readers.shift()(); assert.equal(s.state.preview, 'data:b.png');
});

test('reselecting same uploaded file clears the native input and nested API errors surface', async () => {
  const s = setup(async () => new Response(JSON.stringify({ detail: { message: 'Session ended' } }), { status: 409 }));
  const input = { files: [new File(['a'], 'a.png', { type: 'image/png' })], value: 'a.png' };
  s.context.handleFileSelect({ target: input }); assert.equal(input.value, '');
  await s.context.handleSwapFace(input.files[0]);
  assert.equal(s.state.messages[0], 'Face swap failed: Session ended');
  assert.equal(s.context.swapInputRef.current.value, '');
});
