const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const helperSource = fs.readFileSync("app/lib/anime-raster-transport.server.ts", "utf8");
const helperTree = ts.createSourceFile("transport.ts", helperSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let encoder;
function findEncoder(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "originalRasterEnvelope") encoder = node;
  ts.forEachChild(node, findEncoder);
}
findEncoder(helperTree);
assert.ok(encoder, "find the production raster envelope encoder");
const compiledEncoder = ts.transpileModule(
  `${encoder.getText(helperTree).replace(/^export\s+/, "")}\nglobalThis.encode = originalRasterEnvelope;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const context = vm.createContext({ Buffer, createHash: crypto.createHash });
vm.runInContext(compiledEncoder, context);

test("JSON envelope preserves exact PNG bytes and source SHA", () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 255]);
  const result = context.encode(bytes, "image/png");
  const envelope = JSON.parse(result.body);
  assert.equal(result.headers["Content-Type"], "application/json");
  assert.equal(envelope.schema, "atlas.anime.raster-upload.v1");
  assert.equal(Buffer.from(envelope.image_base64, "base64").compare(bytes), 0);
  assert.equal(envelope.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
});

test("JSON envelope rejects unsupported MIME and out-of-contract sizes", () => {
  assert.throws(() => context.encode(Buffer.alloc(12), "image/jpeg"), /ANIME_RAW_TRANSPORT_INVALID/);
  assert.throws(() => context.encode(Buffer.alloc(11), "image/png"), /ANIME_RAW_TRANSPORT_INVALID/);
  assert.throws(() => context.encode(Buffer.alloc(4_000_001), "image/webp"), /ANIME_RAW_TRANSPORT_INVALID/);
});

test("strict JSON transport is opt-in and legacy multipart remains the default", () => {
  const route = fs.readFileSync("app/api/anime-session/route.ts", "utf8");
  assert.match(route, /ATLAS_ANIME_RASTER_JSON_UPLOAD_ENABLED === "true"/);
  assert.match(route, /body: enrollment as BodyInit/);
  assert.match(route, /body: transport\.body/);
  assert.match(route, /\.\.\.transport\.headers/);
});
