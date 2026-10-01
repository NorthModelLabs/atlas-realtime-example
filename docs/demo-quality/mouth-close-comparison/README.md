# Captured speech-tail comparison — 2026-10-01

Status: complete exact-PCM baseline/candidate/repeat comparison captured and independently reviewed. Earlier closure reproduced, but speech-preservation concerns remain. No production fix accepted or deployed.

## Question

Does reducing the existing idle-mouth close envelope from eight frames to two shorten the lingering mouth motion without damaging quiet articulation? The reference is the original model and runner, not a replacement model.

## Scope and controls

- One owned private L4 in the isolated staging project, with a 30-minute cloud stop deadline and earlier guest shutdown.
- Conditions: eight-frame baseline, two-frame candidate, eight-frame repeat.
- Same seven-second synthetic provider PCM segment from the retained owned conversation, tested at original amplitude and 0.01 amplitude. Each trial adds leading/trailing zero audio; no nonzero audio is clipped or filtered.
- Original 48-to-16 kHz runner resampler is fully flushed, then only zero padding fills the final fixed inference window. Input and paired output sample counts and hashes are checked.
- Model digest `f853fbd1dc92ae7a514e93107e3696e8009f74e929180ac361e2e28e9d52e7e4`; runner digest `830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee`; runner source SHA-256 `55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec`.
- Idle strength 0.85, threshold 0.0001, debounce two frames, open four frames remain unchanged. The retained exact-image call audit shows the deployed head-pose and translation smoothers are called without the mouth envelope. The differently patched root checkout is not the deployed runtime; visual review will still check whole-face context.
- The ten production workers and controller passed an unchanged image/visual-settings audit at 20:28:03 UTC.

## Evidence limits

This is direct model/runner inference, not full RTC transport or browser playout. The reference frame is the last normal-volume 40 ms frame above RMS 0.001, not an exact phonetic endpoint. Quiet trials use that same temporal reference. They are the same synthetic speech attenuated by 40 dB before PCM16 rounding, not naturally quiet speech. Full-volume and quiet trials reuse model/generator state in sequence. Separate condition restarts and the intended A/B/A repeat do not substitute for seeded or repeated controls. Diagnostic 256-pixel JPEGs can hide subtle movement; static contacts alone are insufficient for visual acceptance. A successful replay or unchanged PCM cannot alone establish an acceptable fix.

The fixture includes the complete provider response ending near capture time 95.46 s plus its low-level tail; returned/browser audio ends later. Provider and returned times must not be conflated.

The diagnostic archive is exported through serial, which is significantly slower than inference. Partial archives cannot be accepted as complete. Final results and exact cleanup receipt will be recorded after the bounded run.

Private execution evidence: `/private/tmp/atlas-mouth-close-chunked-20261001/`. No production account, key, balance, image, visual setting, or route was changed by this comparison.

## First replay result

The complete baseline archive accounts for both 288-frame trials and all nine inference calls per trial. Its normalized model input equals paired output PCM byte-for-byte. Normal-volume last-above-model-gate frame is118, versus the stronger-speech reference105: low-level activity lasts another520ms. Consecutive mouth crops show visible articulation during that interval and settling over subsequent frames, with a closed appearance around840–1000ms after the stronger-speech reference. This supports the reported tail symptom for this synthetic clip, not a universal phonetic endpoint measurement.

The VM stopped at20:34:09UTC, before its30-minute cloud maximum. The retained serial output is truncated during candidate export; the exact guest stop cause is not established by the retained output. Baseline archive integrity passes; candidate/repeat acceptance does not. Serial API offsets reported no gaps, but interleaved/partial console lines still lost individual archive chunks. Partial ZIP salvage is explicitly not whole-archive acceptance.

A second control problem was detected: the same48k source was resampled afresh per condition and the resulting PCM hashes differed. Available candidate chunks differ by at most2 PCM16 units (RMS about0.7units) from baseline. This is consistent with resampler dithering, but not independently proven as its mechanism. Since the test concerns a low silence threshold, these differences cannot be silently ignored. The next comparison replays the exact already-retained16k PCM bytes across all conditions, saves frame/input/output hashes, reduces media export volume, uses short console records, and waits for a host integrity acknowledgement before successful shutdown.

## Corrected replay readiness

The compact probe, archive validator and visual-sheet builder are retained alongside this note. They use exactly the two verified baseline16k PCM inputs, not separate resampler outputs. Local producer/validator tests generated a193,186-byte archive containing141 entries at JPEG quality55; all complete archive/content/hash checks passed, and truncated archives, changed archive hashes and altered PCM were rejected. Each serial line was at most384 characters. These were synthetic archive tests using retained baseline images, not a new model pass.

Restart of the same stopped owned staging VM was rejected with `ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS` for L4 capacity in `us-west1-a`. No corrected inference ran. This is an external capacity failure, not a model result, and does not justify promoting the candidate.

The prepared probe preserves288 frames and9calls per trial and retains66consecutive mouth crops plus4full-frame context images. It does not prove natural quiet-speech behavior, seeds/state independence, live transport drainage or final browser acceptance.

Cleanup verified at20:45:58UTC: exact owned VM `6843802051555820318` and its auto-delete boot disk both return404. No staging GPU from this comparison remains allocated. The active quality goal remains open; no production mouth-control setting was promoted.

## Fresh comparison and speech-regression check

After the previous instance and disk were deleted, a fresh allocation succeeded: owned staging instance `1608193770490395052`, created around20:49UTC, with a30-minute cloud stop deadline and28-minute guest shutdown. Its private evidence is `/private/tmp/atlas-mouth-close-fixed-20261001/`. The earlier cleanup statement applies to the previous instance, not this running replacement. Fixture transfer completed; at20:59UTC the replacement was still pulling the pinned images, with no inference result yet.

The installed-image audit identifies `_framewise_mouth_lock_weights` AST SHA-256 `79988781e8a5ba1c095e8cc214418e7544beb2273f1899b9f8b3493c9d05865d` and `_smoothstep01` AST SHA-256 `c48081957944a677c31a043e5902684103d2eddf1093d72269133f5ad7543244`. Evaluating these exact helpers against the fixed fixtures predicts a240ms shorter closing transition for this clip. This is an envelope calculation, not a visual result or a phonetic endpoint measurement.

The same calculation flags a possible speech regression: quiet-trial above-threshold resumption frames75,84,97 receive candidate lock weight0.15625 versus baseline0. The current retained visual range100–165 does not cover those frames. Normal frame110 also differs and is retained. Tail improvement alone therefore cannot establish acceptance; a follow-up must inspect the affected quiet-speech frames as well as returned audio/video and final queue drain. No change to production is justified by the calculation alone.

## Completed fixed-PCM result

All three quality60 archives passed full SHA/CRC/content validation and completion markers by21:11:40UTC. Each condition accounts for two288-frame trials and nine32-frame inference calls per trial. All model-input, paired-input and paired-output PCM hashes match the exact fixtures. See `fixed-pcm-validation.json` and `fixed-pcm-comparison.json`. The read-only log monitor resumed at its saved offset after credential expiration; final validation has no missing chunks or malformed records.

Both eight-frame controls show normal speech-tail closure around frames124–127 (760–880ms after reference105), versus candidate frame121 (640ms). Quiet-trial closure is around110–113 for both controls versus107 for the candidate. These are visual ranges from small diagnostic images, corroborating the calculated closing-envelope effect; they are not measurements from the true audible speech endpoint.

The candidate also visibly narrows the normal mouth around109–110 before reopening111, more than either control. This is a speech-preservation concern, not an accepted fix. Missing quiet frames75/84/97 require targeted follow-up. All whole-call RGBA hashes and retained JPEG hashes differ even between baseline and repeat: rendering is not pixel-deterministic in this setup. The repeated qualitative timing pattern supports an envelope contribution, but pixel differences alone cannot identify its effect.

Selected full-face frames preserve the same human appearance without obvious gross face/eye distortion. This does not establish continuous visual acceptance. The live returned-A/V harness now has36 passing local tests for exact fixture identity, stream close, final segment, A/V drain and post-drain silence; native pinned-container execution remains outstanding. The two recorded intermittent glitches still lack a confirmed root cause. The favicon/source track remains verified separately.

Decision: do not promote close2. Next checks are the missing quiet-articulation frames and synchronized returned-A/V across multiple turns. Production model, runner, audio timing, customer records and keys were unchanged throughout this test.

Cleanup verified at21:13:16UTC: exact replacement instance1608193770490395052 and its boot disk both return404. No GPU from this comparison remains allocated.

Final read-only check at21:14:11UTC: all10production workers ready on the same model/runner/sidecar digests; publicdemo/dashboard/APIhealth returned200; dashboard deployment snapshot and publicdemo alias unchanged. These checks establish current readiness/reachability, not exhaustive customer-session acceptance.
