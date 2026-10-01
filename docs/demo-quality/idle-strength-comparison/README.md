# Idle mouth-strength comparison — candidate not accepted

The isolated GPU comparison completed. Changing idle mouth-lock strength from 0.85 to 1.0 did **not** demonstrate a fix for the live-demo mouth tail. No candidate was deployed. The live symptom remains unresolved.

## Result and limits

Three conditions ran sequentially on the original model and runner: strength 0.85, strength 1.0, then repeat 0.85. Each used identical normal and 0.01-gain public synthetic speech, followed by more than nine seconds of exact-zero PCM. All other model/eye settings, silence threshold, and close/open/debounce timing were preserved.

All six trials passed input/output accounting: 72 inference calls, 2,304 returned frames, paired audio byte-identical to submitted PCM, and identical inputs across conditions. The private input/outcome archives passed hash and frame-count verification. They remain private; only summaries and public-fixture images are committed.

In the reviewed stills, the mouth appears closed by +400 ms with both strengths and remains closed at later sampled points. Quiet voiced samples retain articulation. The 0.85 repeat is consistent. This does not reproduce the live late reopening or demonstrate improvement from strength 1.0. Small compressed-image differences remain; stills cannot prove an absence of continuous micro-motion.

107 of 108 selected JPEGs were reconstructed and hash-verified. The repeat's normal-speech +7,000 ms frame lost serial chunk 0. It is explicitly missing, not reconstructed from another condition. See `western-result/serial-completeness.json` and the blank contact-sheet cell.

These are direct original model/runner calls, not a browser/LiveKit conversation. The fixture uses approximate resampling. No full transport drain, physical playout timing, general quiet-articulation safety, or complete mouth remediation is claimed. See `western-result/capture-analysis.json` and `visual-review.json`.

## Preserved production and cleanup

Five central-region allocations failed for capacity and left no VM or boot disk. The existing private western staging subnet allowed one g2-standard-16/L4 test without new networking. The VM used digest pins, no public IP, a 30-minute cloud stop deadline, independent guest shutdown, and model egress denial. It was stopped and deleted with its boot disk at 19:28:53 UTC; see `western-result/cleanup.json`.

All ten production workers and their controller passed original-image and visual-setting checks at 19:16:06 UTC. The public watcher recorded HTTP 200 for demo, dashboard, and API health throughout its observations. No production model/settings, routes, account rows, balances, or keys were changed by this experiment. The capacity blocker was resolved for this comparison.

## Owned production-session evidence and next investigation

Earlier session `ses_eb8a23a8cf5448ecab45` ran on `avatar-pasteback-main-security-2`, cache `lk_c13d9b22cecf`. Bounded owned-session logs show full 32-frame render batches around the visible late reopening. They do not identify the displayed frame's normalized input samples or idle envelope. The model log has cache initialization but no framewise gate diagnostics. No production instrumentation or customer-media capture was added.

Next, capture actual decoded transport PCM and align it with returned audio/video for an owned synthetic staging conversation. The missing evidence is whether the live reopening coincides with residual model input or a presentation-boundary mismatch. Preserve current audio timing and model pins; do not promote the unproven strength change or resume latency/batching work.

Final release check at 19:29:15 UTC: ten main workers ready on preserved digests; demo, dashboard, and API health HTTP 200; dashboard snapshot and public demo alias unchanged. See `release-health.json`.
