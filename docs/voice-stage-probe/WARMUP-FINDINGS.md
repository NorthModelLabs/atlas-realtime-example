# Warmup investigation — October 1, 2026 UTC

The user reports extremely fast live conversation. Synthetic browser timings are not a production-wide latency claim. Initial connection and ongoing reply timings are separate; later synthetic samples were taken in an already established session, so initial warmup alone does not explain those samples. This does not invalidate the user's experience.

## Findings

Five of ten main-security workers had recent successful background warmup. One had a stale success timestamp and cancellation telemetry consistent with the locally reproduced loop-cancellation defect. Four reported warmup read timeouts. In bounded model-log tails, workers 3/4/5 emitted “No face detected in the source image” for every observed stream request (12/12, 11/11, 11/11); worker 0 had 0/13. Worker 9's sampled tail had no stream requests, so its timeout cause remains unconfirmed. Model health HTTP 200 is not inference acceptance.

The deployed startup script's hash matches the already-local Git version. That version randomly selects a default image from an asset bucket. Warmup used that same default; arbitrary icons/non-face assets are unsuitable. Metadata and logs support this diagnosis without exporting production image bytes or startup-script contents. Automatic approval review rejected those raw exports; metadata-only checks and existing Git history provided the needed evidence instead.

## Targeted staging candidate

Only `_warmup_loop` and `_run_avatar_service_warmup` change. Child cancellation no longer kills the background loop; parent shutdown still cancels it. Background warmup uses a separately packaged, known public demo face via `AVATAR_WARMUP_IMAGE_PATH`. Customer-selected/default avatar behavior and the startup script stay unchanged. No GPU model, renderer, sidecar, account or key changes are included.

The patch fails unless the dispatcher source hash exactly matches the captured production version. It verifies the resulting source hash and every other existing workspace file. Tests exercise cancellation, skipping busy sessions, idle resumption, shutdown, and separation from the customer's image. The public face has already generated successfully in owned demo acceptance sessions using the main model, but that does not replace an isolated warmup inference test.

The original dispatcher image was mirrored by immutable digest into the isolated staging registry; manifest bytes matched. No production registry mutation, mutable tag change, deployment or IAM expansion was used. The first candidate build lacked permission to pull the production base, addressed by that staging mirror. The second caught an incorrect integrity-check path for `agent_worker.py`; the pinned launcher image contains `avatar_runner.py`, `dispatcher.py`, `mouth_mode.py` and `start-launcher.sh`. The corrected guard inventories all existing non-dispatcher workspace files and retains explicit runner/mouth/startup hashes.

## Remaining acceptance

Build `1776406b-6360-432f-9b84-e5f9135510fc` succeeded. The staging controller image is pinned to `sha256:7236e4d3214079381380859b3c6099b5d719f68b129c73086e3e88e63b333004`. In-image tests passed cancellation survival, busy-session skipping, idle resumption, shutdown cancellation and independent warmup fixture selection. All non-dispatcher workspace bytes remained unchanged, including explicit runner, mouth-mode and startup-script hashes. Next, run isolated inference with the exact main model digest. The bounded new staging GPU VM could not be created: GCE returned UNAVAILABLE and authoritative checks found no instance. No benchmark has run there. Do not use a production GPU or substitute the unrelated test4 model. This candidate is not deployed to production and does not yet prove a latency improvement or the ~1.3-second target.

At 02:44 UTC, demo, API health and dashboard returned HTTP 200; all ten main-security pods were ready with the same avatar, dispatcher and sidecar image digests. Existing customer data and keys were untouched by this work. Intermittent continuity and post-speech motion still need their own acceptance; this patch does not claim to resolve them.

The archived Dockerfile expects `patch.py` and `test_candidate.py`; the corresponding review files here are `warmup-controller-patch.py` and `check-warmup-controller.py`. The fixture comes from the checked-in public demo image above; these files describe the successful staging build, not a production deployment command.
