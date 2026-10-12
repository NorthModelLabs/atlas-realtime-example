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

## October 12 source-only continuation

The owner again reported friends unable to switch references and requested an
anime demo. The retained served/source mismatch above explains the October 7
incident, not necessarily the currently served implementation. Root's current
read-only public GET returned HTTP200/9497B (HTML SHA
`eb0f23e541b734663e696b5569d8e9fef50360b2d17285f46e1c6de194dfec16`).
An initial parser incorrectly filtered out script URLs with `?dpl=` queries;
root corrected that observation. The actual page title is Atlas Realtime
Example App, deployment `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`. Its exact
`app/page-f0fd68c1014808eb.js?dpl=...` returned HTTP200/72326B, SHA
`989028ec43749652fa2010d998ed97656b3f621351a69928545a5f08e5196308`.
Deployment and bundle path match the retained October 7 witness. This child
did not locate a retained October 7 whole-bundle SHA for a separate byte-level
comparison; absence of minified variable names is not semantic proof. This
child made no hosted requests or promotion. The reference fix still requires
promotion of the exact dedicated-demo feature branch, not `main` or the
separate legacy Vercel project's auto-deploy boundary.
All four local preset files exist. Do not confuse the marketing site's
`/demos` video gallery with this dedicated Demo Atlas application.

Two additional code defects were fixed: FastAPI `detail: string` errors were
hidden by a parser accepting only `detail.message`; initial default loading
also converted a 404/HTML body into a purported JPEG. The new guards preserve
real errors and refuse non-image/default-error bodies. Human swap serialization,
queued-versus-applied semantics and timeout ambiguity remain intact.

The new `/anime` prototype is OFF unless the server explicitly sets
`ATLAS_ANIME_DEMO_ENABLED=true`. It reuses the SAME public `ATLAS_API_URL`,
server-only API key, origin/browser capabilities, SDK and session lifecycle.
Explicit **Prepare & Start** uploads to the existing authenticated enrollment
API, polls its opaque handle, and creates a session only after authenticated
readiness using `mouth_mode=anime_realtime`. Selecting/uploading alone does not
enroll, generate, start a room or call Prodia. Cancellation stops waiting/new
session creation but does not claim to cancel an accepted billable enrollment.
The SDK still owns exact session cleanup if its final creation ACK is stale.

Preparation may be billable under the configured API account; the interface
states that explicitly, without inventing a live price. No human portraits or
private accepted-bank assets were copied into public anime examples. Cross-bank
live face refresh is not advertised: end the anime session before preparing a
different portrait. Decorative background generation versus authored-mouth-bank
preparation remains an owner clarification, not an automatic provider call.

Before enabling/deploying, root must verify the CURRENT public enrollment
availability, cost/hold policy, selected anime production route and bank
readiness. Accepted F225 recordings/runtime do not prove arbitrary uploaded
portrait enrollment, nor do local mocked route tests. No deploy, push, image
build, provider/model call or live session occurred in this source continuation.

Final local checks: 31 tests passed using the actual extracted face-selection,
proxy/enrollment handlers, client enrollment/poll/start flow and capability
grant code with synthetic transports; TypeScript no-emit passed; targeted ESLint
has zero errors and the existing voice-hook dependency warning. A hosted build,
live portrait switch, actual anime enrollment and production A/V acceptance
were not run. The human reference-fix promotion does not depend on enabling
this OFF anime prototype or authorizing new paid preparation.

## Current deployed reference chooser follow-up

Root subsequently confirmed commit `1edea51038d234bd0df833adab6cc2d5ed70fc53`
live on dedicated Demo Atlas deployment `dpl_8aeWX7srLternmRgmLGKr6CD1yYJ`,
with all four reference assets returning HTTP 200 and matching local bytes.
That supersedes the prior held-promotion status, not the absent browser/media
acceptance. A newly reported Apple Settings screenshot showed an empty ring.
No browser tool was available here, and source review did not prove that only
one preset rendered: the human JSX maps all four, with no hide/nth-child rule.
HTTP asset availability alone is not browser image decode or layout evidence.

The concrete usability defect was image-only, empty-alt, lazy thumbnails with
no visible names or image-failure fallback. The local follow-up adds four grid
columns, fixed thumbnail boxes, eager loading, visible reference names and
initial-letter fallback. An image error hides only that failed image; selection
and session callbacks are unchanged, with no upload, generation or retry.
Actual Apple JSX rendered through real Next/Image produces four named eager
images and four working callback bindings in the local SSR check. This is not
a hydrated browser screenshot reproduction or a hosted deployment claim.

Local follow-up checks: 28 tests passed across the new chooser check and existing
face selection/anime client/route checks; TypeScript no-emit passed; targeted
ESLint has zero errors and the same pre-existing voice dependency warning.
The new regression file is `tests/apple-reference-chooser.test.mjs`.

Anime remains OFF. Local API source has authenticated POST/GET
`/v1/realtime/anime/enrollments` and session creation with `anime_enrollment_id`
plus `mouth_mode=anime_realtime`, matching the prototype. Actual serving-source
and operational flags are not established by that local source review:
enrollment availability requires enabled enrollment, cost guard, database,
internal service/auth and handle secret; session routing requires enabled anime
mode and its configured agent. The local default hold/charge values are not
live prices. Confirm current costs and actual uploaded-bank readiness before
enabling the UI. Paid generation on image selection remains absent.
