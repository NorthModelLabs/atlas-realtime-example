# Current demo quality goal — October 1, 2026

The user's latest instructions supersede the earlier latency target. Work on both:

1. Lingering mouth movement after the avatar finishes speaking. Compare actual returned audio ending with the subsequent rendered frames; reproduce, fix the demonstrated cause, and visually verify repeated turns.
2. Occasional playback glitches, stutters or cutoffs. Correlate visible/audio discontinuities with available playback and transport evidence and fix the demonstrated cause.

Preserve the fast response the user already experiences. General latency reduction, smaller inference batches, and pursuing a 1.3-second benchmark are out of scope. Do not freeze the entire avatar to conceal the mouth issue or truncate speech to make the end appear earlier.

Validate fixes in isolation before promotion, preserve existing customer records/keys and all production GPU/model image digests, and clean up owned test sessions. Neither issue is currently verified fixed. Previously completed latency experiments are historical evidence, not a reason to continue that work.

The active goal tracker was created for item 1 immediately before item 2 was added. Its available update operation supports status only, so this document records the expanded scope without falsely completing the unfinished goal. Completion requires both items above.


Latest evidence (09:32 UTC): all ten main human workers and their replacement template preserve the original model, runner and sidecar image pins and explicit eye/head/mouth/motion settings. Demo, dashboard and API health pass; the public demo alias is unchanged. Fresh owned browser sessions traced to main-security workers 5 and 7, then were deleted successfully. Use the [read-only model guard](human-model-guard/README.md) before and after any approved change, plus a real visual/session routing check.

The [nine-trial quiet-speech comparison](quiet-speech/README.md) retained 142/144 hash-checked images and preserved all 2304 paired audio frames. Thresholds 0.0002 and 0.0003 improve the controlled faint-noise tail but suppress/delay a quieter syllable opening. Both threshold-only candidates are rejected for production promotion. The comparison VM and boot disk were deleted and verified absent. An envelope-only faster-opening hypothesis remains unrendered and does not solve all low-amplitude cases.

The latest [upstream-tail browser trace](upstream-tail/README.md) reproduces an open mouth at roughly 0.4–0.5 seconds after returned quiet, then closed by 0.8–0.9 seconds in four sampled tails. Brief low-level upstream signals support further gate investigation but are not model-input PCM. Six 100–167 ms video gaps occur during silence without a packet-loss increase in the five comparable windows; this does not reproduce or negate the earlier larger packet-recovery stall.

Appearance caveat: a wider-eyed idle expression appears in the longer preview capture even with the verified original model/configuration. Do not claim every expression is acceptable merely from hashes. Preserve eye settings during the mouth investigation and retain that frame for visual regression checks. No production rendering change or fix is claimed; the goal remains active.


Follow-up transport comparison: [codec-tail](codec-tail/README.md) tested the current DTX setting against a protected continuous-audio preview. Lingering movement still occurs without DTX; the switch was removed from source and neither preview was promoted. Both owned sessions were deleted. Public demo/dashboard/API checks pass with unchanged public alias. Google Cloud access now requires reauthentication, preventing a fresh ten-worker inventory and worker-side causal capture; the last successful exact-image/configuration guard remains 09:39:07 UTC. Next: owned-session model-input PCM capture/replay, preserving speech and timing, rather than another arbitrary global threshold change.

The [staging renderer-input recorder](renderer-input-capture/README.md) is now prepared and passes four local forwarding/privacy/budget/source-identity contract tests. It is not attached to any runtime and has not executed against the preserved image. The repeated read-only Cloud check still requires interactive reauthentication. No new sessions, GPUs or production changes were created during recorder preparation.
