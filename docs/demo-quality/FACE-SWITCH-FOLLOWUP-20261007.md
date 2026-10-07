# Demo reference-image switching follow-up

Status: source fix and local verification; not a public deployment.

## Actual public/source mismatch

On 2026-10-07, a read-only request to `demo.northmodellabs.com` returned deployment `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`. Its exact served `app/page-f0fd68c1014808eb.js` still contained the earlier selector:

- A successful live swap increments the selection counter a second time. The preset's `finally` then fails its counter comparison and never clears its loading state.
- Local file inputs do not clear their value, preventing selection of the same file again.
- An HTTP success is reported as a face swap without checking failed worker metadata delivery.

Those source defects were fixed in `123fb32189994b3e3fe309a981214222dde0f18f`, but that commit is **not the publicly served deployment**. Pushing a branch is not deployment. Do not reconnect the legacy Vercel Git integration or promote an unrelated image to repair this; preserve the established dedicated-demo boundary.

## Remaining source fixes in this follow-up

- All file inputs and drag/drop send a live PATCH when connected; disconnected selection remains local.
- Clear the native input immediately, including a busy/rejected upload, so the same file can be selected again.
- Bound the client update/response parsing at 35 seconds and upstream proxy at 30 seconds; always release loading/serialization state.
- Never automatically retry an ambiguous timed-out write. Tell the user to check the current avatar first.
- Ignore late responses from a disconnected/different session.
- Explain busy selection instead of silently dropping it; keep one live update in flight to avoid unordered worker updates.
- Preserve explicit failed worker-delivery errors; do not call a queued response already applied.
- Use the selected portrait's name instead of labelling every Apple-mode portrait John.

No session capabilities, origin checks, account/key data, model weights, GPU routes, or production configuration changed.

## Verification

`node --test tests/face-selection.test.mjs tests/face-swap-route.test.mjs tests/demo-access.test.mjs tests/voice-captions.test.mjs tests/voice-response.test.mjs`: 26 passed before the name-only follow-up; rerun after final edit.

`npx tsc --noEmit --incremental false` and `git diff --check` passed.

A disposable owned Chrome against a credential-free loopback development server exercised the actual hydrated UI: John -> Reel preset -> John preset -> uploaded Reel image -> reselect the same upload. Root visually inspected all four screenshots. No session POST, PATCH, DELETE or provider call occurred in that browser test; connected PATCH semantics are separately tested using the extracted actual production callbacks/proxy. This is **not** live GPU swap acceptance.

Private evidence: `/private/tmp/atlas-demo-face-switch-visual-20261007-DZzWgr/receipt.json` and four screenshots. The owned browser profile was removed after proving zero survivors. Local preview resolved installed Next.js 16.2.2 although package.json specifies 16.3.8; no dependency install/build was performed and no claim is made about a new production build.

Production deployment remains held by the owner's latest instruction. The public demo still needs a reviewed frontend promotion before users receive this source fix.
