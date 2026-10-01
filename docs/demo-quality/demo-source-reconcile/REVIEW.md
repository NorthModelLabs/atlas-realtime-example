# Runtime/source review

Reviewed PR base `8f0436c` → head `f35b6e1`, plus two coordinated local cleanups: remove the duplicated teacher-mode error alert; allow CommonJS imports specifically in archived `docs/**/*.cjs` scripts so lint checks retained evidence without altering its contents. These cleanups are not committed or public at this review point. `review-receipt.json` binds validation to the runtime/test/config file bytes, so a documentation-only commit can preserve that receipt while any later runtime change invalidates it.

## Review findings

No newly introduced critical runtime security defect was identified in this bounded diff review. This is not an assertion that all vulnerabilities or abuse risks are closed.

- Resource ownership: new HMAC capabilities bind resource kind, exact ID and one-hour expiry; comparison uses `timingSafeEqual`. Session access requires an HttpOnly/Secure/SameSite strict cookie scoped to the session route. Viewer links use a separately signed `viewer` capability in the fragment; it permits viewer creation, not owner DELETE/PATCH. Missing signing configuration fails closed. Tests cover forgery, expiry, missing key, cross-resource, cross-browser and cross-origin denial.
- Voice route: requires the session owner capability and correct origin before accepting SDP. It validates type, length, SDP preamble and audio section, checks the server-owned Atlas session, then sends the fixed provider endpoint the server-held key. The browser receives SDP, not API credentials. This review did not change provider parameters, model routes, GPU settings or media timing.
- Public-demo limitation: session creation and legacy chat/TTS/scribe routes use origin checks, **not login or rate limiting**. Non-browser callers can supply an Origin header. Session ownership prevents controlling another browser's resources; it does not prevent an arbitrary caller from creating its own public demo session or consuming provider credits. That limitation is already documented in RESTORATION.md and remains a separate product/abuse policy concern. This source-only merge does not expand live exposure because no deployment is made.
- Client media: new provider audio is connected to the existing Atlas outgoing destination; only returned avatar audio is played locally. Connection cleanup stops owned tracks/closes peer/data channel and aborts negotiation. Caption IDs and response queue suppress superseded updates; the deterministic race tests pass. The hook dependency warning refers to `voice.toggleMicrophone`; the stable callback itself is in the dependency array. No suppression added.
- SDK 0.2.2→0.2.3: inspected unpacked JavaScript changes. It adds video attachment retry, avatar-participant filtering, fixed native video quality request, cancellation/version protection and owned-session cleanup. Its TTS helper adds a 240ms tail-drain timer, but the new interactive demo's persistent streaming path does not call that helper. No model/weights are present or replaced in the SDK change.
- Post-public runtime differences are gated diagnostics plus the teacher alert cleanup. Diagnostic functions return immediately unless `NEXT_PUBLIC_VOICE_DIAGNOSTICS === "true"`; the live deployment has not changed. No fix for mouth tail or intermittent playback is claimed.
- Dependency changes pin Next/eslint-config-next 16.3.8 and vendored Atlas React 0.2.3. The package-lock matches package.json and the production build succeeds. This review did not run a fresh vulnerability-database audit and does not claim dependencies have no published advisories.
- PR bulk: of the original 834 changed files, 788 are retained documentation/evidence, 21 under app (including favicon), ten isolated experiments, five tests, three scripts and seven root/vendor/public configuration or assets. No GitHub workflows were added by this diff; Next's route/build output contains only application routes, not experiments or diagnostic Python scripts.

## Validation

- Eleven existing capability/caption/response tests passed.
- `npm run lint` passed with zero errors and three warnings (one existing hook dependency, two unused variables in archived loopback diagnostics).
- `npx tsc --noEmit` and optimized Next production build passed after the two narrow cleanups.
- Rebuilt synthetic HTTP suite passed: cross-browser/resource/origin rejected, owner session permitted, viewer scope enforced, malformed/oversized SDP rejected, zero real-provider calls. All owned local processes exited.
- Gitleaks scanned all 48 commits in the PR range (~15.17MB). Its two matches were inspected and are fixed synthetic model cache names, not secrets. No secret values or auth material were retained in this audit's output.
- Five fully mocked reconciliation-script tests passed: read-only no writes, success leaves legacy auto-deploy disabled, rejected merge restores pre-merge Git/draft settings, ambiguous successful merge never re-enables Git, head drift blocks every write.
- Live read-only reconciliation dry run passed at `f35b6e1`; private snapshot `/private/tmp/atlas-demo-source-reconcile-20261001/dry-run`. The script has never been run with `--apply`.

## Execution handoff

After parent reviews and commits the final source (and updates the PR description), push the same PR branch, await its exact-head checks, then run the read-only command with that final head and current expected main SHA:

```sh
python3 docs/demo-quality/demo-source-reconcile/reconcile.py \
  --expected-head FINAL_REVIEWED_HEAD \
  --expected-base 8f0436c06ec212aaff02a742463443c1ecd3d54f \
  --receipt docs/demo-quality/demo-source-reconcile/review-receipt.json \
  --output /private/tmp/atlas-demo-source-final-preflight
```

Only after reviewing the output, run the same command with a new output directory and `--apply`. It changes legacy Git deployment creation, PR draft state and the exact-head source merge only. The script rejects any tracked runtime change or receipt mismatch, saves private rollback state, checks no builds are active, verifies aliases, and watches both deployment lists for 40 seconds after merge. An uncertain merge outcome never triggers re-enabling auto-deploy. GitHub's merge API conditions on head SHA, not base SHA; coordinate to avoid another writer to `main` during the short checked merge window. Existing runtime limitations are preserved rather than silently treated as solved.
