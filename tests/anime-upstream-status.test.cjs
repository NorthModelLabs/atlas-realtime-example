const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const source = fs.readFileSync("app/api/anime-session/route.ts", "utf8");
const tree = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let helper;
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "upstreamResult") helper = node;
  ts.forEachChild(node, walk);
}
walk(tree);
assert.ok(helper, "find the production upstream-result handler");

const compiled = ts.transpileModule(
  `globalThis.upstreamResult = ${helper.getText(tree)};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
function harness() {
  const returned = [];
  const context = vm.createContext({
    fail: (...args) => { returned.push(args); return { kind: "safe-error", args }; },
    NextResponse: { json: (body, options) => ({ kind: "json", body, options }) },
  });
  vm.runInContext(compiled, context);
  return { run: context.upstreamResult, returned };
}

test("non-JSON edge 403 stays a safe 403 instead of becoming a misleading 502", () => {
  const { run, returned } = harness();
  const result = run({ status: 403 }, null);
  assert.deepEqual(result.args, [403, "upstream_forbidden", "Atlas rejected the anime portrait request."]);
  assert.equal(returned.length, 1);
});

test("non-JSON upstream success is still treated as an invalid 502", () => {
  const { run } = harness();
  const result = run({ status: 200 }, null);
  assert.equal(result.args[0], 502);
  assert.equal(result.args[1], "upstream_error");
});
