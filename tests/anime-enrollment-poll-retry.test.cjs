const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const source = fs.readFileSync("app/api/anime-session/route.ts", "utf8");
const tree = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let pollHelper;
let retryClassifier;
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "fetchEnrollmentStatus") pollHelper = node;
  if (ts.isFunctionDeclaration(node) && node.name?.text === "retryableEnrollmentPollStatus") retryClassifier = node;
  ts.forEachChild(node, walk);
}
walk(tree);
assert.ok(pollHelper, "find the production same-enrollment status poll helper");
assert.ok(retryClassifier, "find the production transient-status classifier");

function harness(fetch) {
  let now = 1_000;
  const waits = [];
  const context = vm.createContext({
    ATLAS_API_KEY: "test-only",
    ENROLLMENT_POLL_TRANSIENT_RETRIES: 3,
    Date: { now: () => now },
    fetch,
    sleep: async (ms) => { waits.push(ms); now += ms; },
  });
  const compiled = ts.transpileModule(
    `${retryClassifier.getText(tree)}\n${pollHelper.getText(tree)}\nglobalThis.poll = fetchEnrollmentStatus;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInContext(compiled, context);
  return { poll: context.poll, waits };
}

test("transient status GET failures retry only the same durable handle, with bounded backoff", async () => {
  const statuses = [503, 429, "network", 200];
  const urls = [];
  const { poll, waits } = harness(async (url, options) => {
    urls.push([url, options]);
    const next = statuses.shift();
    if (next === "network") throw new Error("temporary network failure");
    return { status: next };
  });
  const response = await poll("https://atlas.invalid/enrollments/e1", 10_000);
  assert.equal(response.status, 200);
  assert.deepEqual(urls.map(([url]) => url), Array(4).fill("https://atlas.invalid/enrollments/e1"));
  assert.deepEqual(waits, [250, 500, 1_000]);
  assert.ok(urls.every(([, options]) => options.cache === "no-store"));
});

test("permanent authorization errors do not retry", async () => {
  let calls = 0;
  const { poll, waits } = harness(async () => { calls += 1; return { status: 403 }; });
  const response = await poll("https://atlas.invalid/enrollments/e1", 10_000);
  assert.equal(response.status, 403);
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});

test("network failures stop after the configured three retries", async () => {
  let calls = 0;
  const { poll, waits } = harness(async () => { calls += 1; throw new Error("offline"); });
  assert.equal(await poll("https://atlas.invalid/enrollments/e1", 10_000), null);
  assert.equal(calls, 4);
  assert.deepEqual(waits, [250, 500, 1_000]);
});

test("paid enrollment and session POSTs stay outside the polling retry helper", () => {
  const route = fs.readFileSync("app/api/anime-session/route.ts", "utf8");
  assert.match(route, /fetchEnrollmentStatus\(`\$\{ATLAS_ANIME_API_URL\}\$\{pollUrl\}`, deadline\)/);
  assert.equal((route.match(/method: "POST"/g) || []).length, 2);
});
