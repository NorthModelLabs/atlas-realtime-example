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

## Isolated probe recovery and buffering evidence

The large inline startup request timed out without a native operation. A compact 14,140-byte startup, using a private immutable staging image containing only public/synthetic fixtures, produced native operations. Zone b failed with an authoritative L4 stockout and recommended zone c; c also returned a stockout. Zone a then created exactly one `g2-standard-16` L4 VM, `atlas-stg-voice-latency-20260930`, with one-hour STOP scheduling and the guest's 55-minute stop. The same regional private subnet and service account are used, without new IAM or firewall grants. Both model and fixture manifests are pinned. Only loopback port 8000 is published; no registry sidecar or customer API registration runs. The main model's mirrored manifest is byte-identical to production.

The small request succeeded in reaching a native operation; this supports a request-size/transport issue for the earlier unrecorded timeouts but does not establish its exact cause. Do not confuse that with the separately confirmed zonal GPU stockouts. The new VM is running the bounded experiment; results and final stopped/deleted state must be recorded before considering cleanup complete.

The existing owned synthetic session's receive-buffer averages were 239.6 ms for provider audio, 157.7 ms for returned avatar audio and 98.4 ms for returned video. These are session averages, not per-response delay or values to add blindly. Owned GPU logs independently reported 32-frame batches, median input lag 1312.5 ms and median whole-batch inference/streaming duration 1311.5 ms. Input lag and queue delay overlap. Whole-batch duration is not first-frame latency. These observations justify isolating model first-frame delivery before attributing the user's occasional gaps or overall responsiveness to model speed.

Live runner source hash `55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec` did not match the checked local Git revisions. Therefore recent local runner code is not treated as authoritative evidence for production buffer logic. Runtime logs and the exact image digest remain the relevant sources. No production runner code or configuration was modified.

The active zone-a VM identity is `5752044785369117268`; its native insert operation completed successfully. Serial output confirmed L4 and private registry proxy readiness. Registry audit logs recorded successful blob requests under the staging service account. The exact model has 53 layers totaling 19.29 GiB compressed; the pull is still running, not a completed benchmark. The optional IAP read-only SSH attempt could not reach port 22; no firewall rule was added. Serial/Compute monitoring remains available and the enforced stop guard is unchanged. Record inference output and final cleanup in a subsequent update; neither is claimed complete here.

The independent provider pause experiment and its rejected semantic-VAD alternative are documented in VAD-COMPARISON.md. Production remains on its previous turn-detection settings. At 03:10 UTC, the ten main workers were ready with unchanged image IDs and demo, dashboard and API health returned 200.

## First isolated inference result and stopped state

The mirrored main model started successfully with egress denied. Its first 32-frame request returned 32 valid 1024×1024 RGB frames: first frame 3364.3 ms, complete stream 4234.6 ms. This is a single initial request on a newly started model, not a warmed conversation measurement. The next short-batch case raised a benchmark `AssertionError` before recording a result; its exact failed condition must be exposed before attributing it to the model or assuming short-frame support. Therefore the cold/warm comparison is incomplete, and no production latency conclusion or optimization acceptance follows from this result.

The owned guest's failure handler stopped it. Compute authoritatively reported `TERMINATED`, instance ID `5752044785369117268`, last-stop timestamp 03:14:31 UTC. No staging GPU remains running for this probe; its private disk and cached pinned images are retained for the bounded follow-up. The existing serial monitor may finish its final observation; do not create a second VM or restart from an observation timeout.

The inherited `sidecar-image-ready` phase label referred to the static fixture image in this modified probe. No sidecar container was started: the registration phase was removed from the generated startup. Future probes should rename that label to avoid ambiguity.
