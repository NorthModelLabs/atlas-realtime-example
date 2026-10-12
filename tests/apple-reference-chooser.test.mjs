import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Image = require('next/image').default;
const postcss = require('postcss');
const source = fs.readFileSync(new URL('../app/demo.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('demo.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let options, presets, defaultUrl, errorHandler;
function walk(node) {
  if (ts.isVariableDeclaration(node)) {
    if (node.name.getText(tree) === 'FACE_PRESETS') presets = node.initializer.getText(tree);
    if (node.name.getText(tree) === 'DEFAULT_FACE_URL') defaultUrl = node.initializer.getText(tree);
  }
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(p =>
    ts.isJsxAttribute(p) && p.name.getText(tree) === 'className' &&
    p.initializer?.getText(tree) === '"apple-avatar-options"')) options = node.getText(tree);
  if (ts.isJsxSelfClosingElement(node) && node.attributes.properties.some(p =>
    ts.isJsxAttribute(p) && p.name.getText(tree) === 'loading' && p.initializer?.getText(tree) === '"eager"')) {
    const attribute = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === 'onError');
    if (attribute) errorHandler = attribute.initializer.expression.getText(tree);
  }
  ts.forEachChild(node, walk);
}
walk(tree);
function chooser() {
  assert.ok(options && presets && defaultUrl);
  const clicks = [];
  const context = vm.createContext({ require, exports: {}, Image, selectedFaceId: 'enterprise-b1450303',
    selectPresetFace: preset => clicks.push(preset.id) });
  const code = ts.transpileModule(`const DEFAULT_FACE_URL=${defaultUrl};const facePresets=${presets};globalThis.chooser=(${options});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInContext(code, context);return { element: context.chooser, clicks };
}

test('actual Apple JSX + real Next/Image renders all four eager named choices', () => {
  const { element, clicks } = chooser();const html = renderToStaticMarkup(element);
  assert.equal((html.match(/<button\b/g) || []).length, 4);
  assert.equal((html.match(/<img\b/g) || []).length, 4);
  assert.equal((html.match(/loading="eager"/g) || []).length, 4);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  for (const [label, src] of [['Default', '/faces/default.png'], ['Reel', '/faces/reel-alt.png'],
    ['Enterprise', '/faces/enterprise-b1450303.jpg'], ['Jennifer', '/faces/jennifer.png']]) {
    assert.ok(html.includes(`src="${src}"`));assert.ok(html.includes(`>${label}</span>`));
    assert.ok(html.includes(`aria-label="Use ${label} avatar"`));
  }
  for (const button of React.Children.toArray(element.props.children)) button.props.onClick();
  assert.deepEqual(clicks, ['default', 'reel-alt', 'enterprise-b1450303', 'jennifer']);
});

test('actual image-error callback exposes local fallback without a session action', () => {
  assert.ok(errorHandler);let requests = 0;
  const context = vm.createContext({ fetch: () => { requests++; throw new Error('no provider'); } });
  vm.runInContext(ts.transpileModule(`globalThis.fail=${errorHandler};`, {}).outputText, context);
  const target = { style: {} };context.fail({ currentTarget: target });
  assert.equal(target.style.visibility, 'hidden');assert.equal(requests, 0);
  const { element } = chooser();
  for (const button of React.Children.toArray(element.props.children)) {
    const [thumbnail, label] = React.Children.toArray(button.props.children);
    assert.ok(thumbnail.props.children[0].props.children);assert.ok(label.props.children);
  }
});

test('CSS reserves four columns and local thumbnail box, not overlapping buttons', () => {
  const css = postcss.parse(fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8'));
  const declarations = selector => {
    const values = {};css.walkRules(selector, rule => rule.walkDecls(d => { values[d.prop] = d.value; }));return values;
  };
  assert.equal(declarations('.apple-avatar-options').display, 'grid');
  assert.equal(declarations('.apple-avatar-options')['grid-template-columns'], 'repeat(4, minmax(0, 1fr))');
  assert.equal(declarations('.apple-avatar-option-image').position, 'relative');
  assert.equal(declarations('.apple-avatar-option-image').width, '48px');
  assert.equal(declarations('.apple-avatar-option-image').height, '48px');
  assert.equal(declarations('.apple-avatar-options button').width, '100%');
});
