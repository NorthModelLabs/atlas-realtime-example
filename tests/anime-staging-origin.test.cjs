/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "app/lib/anime-api-origin.server.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleObject = { exports: {} };
new Function("exports", "require", "module", compiled)(moduleObject.exports, require, moduleObject);
const {
  ATLAS_STAGING_ANIME_API_ORIGIN,
  ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN,
  animeStagingFlowEnabled,
  resolveAnimeApiOrigin,
} = moduleObject.exports;
const stagingEnv = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.atlas-staging.example"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/=(.*)/s).slice(0, 2)),
);

assert.equal(stagingEnv.ATLAS_ANIME_API_URL, ATLAS_STAGING_ANIME_API_ORIGIN);
assert.equal(stagingEnv.ATLAS_API_URL, ATLAS_STAGING_ANIME_API_ORIGIN);
assert.equal(stagingEnv.ATLAS_ANIME_TARGET, "atlas_staging");
assert.equal(stagingEnv.ATLAS_ANIME_DEMO_ENABLED, "false");
assert.equal(stagingEnv.ATLAS_ANIME_ENROLLMENT_ENABLED, "false");
assert.equal(stagingEnv.ATLAS_ANIME_SESSION_ENABLED, "false");
assert.equal(resolveAnimeApiOrigin(stagingEnv), ATLAS_STAGING_ANIME_API_ORIGIN);
assert.equal(animeStagingFlowEnabled(stagingEnv), false, "staging flow is disabled by default");

const accidentallyProductionBound = {
  ...stagingEnv,
  ATLAS_ANIME_API_URL: "https://api.atlasv1.com",
  ATLAS_ANIME_DEMO_ENABLED: "true",
  ATLAS_ANIME_ENROLLMENT_ENABLED: "true",
  ATLAS_ANIME_SESSION_ENABLED: "true",
};
assert.equal(resolveAnimeApiOrigin(accidentallyProductionBound), "");
assert.equal(animeStagingFlowEnabled(accidentallyProductionBound), false);
assert.equal(
  resolveAnimeApiOrigin({ ...accidentallyProductionBound, ATLAS_ANIME_TARGET: "", NODE_ENV: "development" }),
  "",
  "local development must reject the production anime API even without the staging marker",
);

const enabledStaging = {
  ...stagingEnv,
  ATLAS_ANIME_DEMO_ENABLED: "true",
  ATLAS_ANIME_ENROLLMENT_ENABLED: "true",
  ATLAS_ANIME_SESSION_ENABLED: "true",
};
assert.equal(resolveAnimeApiOrigin(enabledStaging), ATLAS_STAGING_ANIME_API_ORIGIN);
assert.equal(animeStagingFlowEnabled(enabledStaging), true);

const localStagingTunnel = {
  ...enabledStaging,
  NODE_ENV: "development",
  ATLAS_API_URL: ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN,
  ATLAS_ANIME_API_URL: ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN,
  ATLAS_STAGING_LOCAL_TUNNEL: "true",
};
assert.equal(resolveAnimeApiOrigin(localStagingTunnel), ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN);
assert.equal(animeStagingFlowEnabled(localStagingTunnel), true);
assert.equal(animeStagingFlowEnabled({ ...localStagingTunnel, ATLAS_STAGING_LOCAL_TUNNEL: "false" }), false);
assert.equal(animeStagingFlowEnabled({ ...localStagingTunnel, ATLAS_ANIME_API_URL: "https://api.atlasv1.com" }), false);

assert.equal(resolveAnimeApiOrigin({
  NODE_ENV: "production",
  ATLAS_API_URL: "https://api.atlasv1.com",
}), "https://api.atlasv1.com", "production anime defaults to the human session API");
assert.equal(resolveAnimeApiOrigin({
  NODE_ENV: "production",
  ATLAS_API_URL: "https://api.atlasv1.com",
  ATLAS_ANIME_API_URL: "https://separate-anime.example",
}), "", "production refuses a separate anime API host");
assert.equal(resolveAnimeApiOrigin({
  NODE_ENV: "development",
  ATLAS_API_URL: "http://127.0.0.1:8200",
}), "http://127.0.0.1:8200", "local anime mode inherits its local session API");

console.log("Anime staging origin pinned; production origin rejected; flow off by default.");
