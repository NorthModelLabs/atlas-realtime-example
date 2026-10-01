# Mouth-tail and intermittent stutter investigation

The current scope is residual mouth movement after speech and occasional playback glitches. General response-speed tuning remains out of scope. No runtime fix or production promotion is claimed.

## Findings

| Observation | Evidence | What it establishes |
| --- | --- | --- |
| Brief mouth tail is visible | Five captured response tails; one remains open at 406 and 809 ms after returned audio quiet, then closed at 1414 ms | The user's report is supported in an owned synthetic conversation |
| It is not simply a frozen video element | 35 callbacks/presentation advances during that tail's first 1.5 s; returned-audio peak RMS after 200 ms is 0.00011 | The mouth shape is present in advancing returned video |
| Clean-silence generated frames settle sooner | Three exact-model trials close by the 400 ms sample and remain closed at retained later samples through 2 s | These clean inputs do not reproduce the longer browser tail; see [model capture](../model-tail/README.md) |
| Short presentation stalls occur | Six gaps over 100 ms (100.1–166.6 ms), corresponding arrival gaps 131.1–236.7 ms | Short playback disturbances are reproducible |
| Two stalls include substantial post-capture delay | Source timestamp steps 40/37 ms while estimated capture-to-arrival increases by 91.1/130.3 ms | Delivery timing contributes to these two events; exact encoder/publication/SFU/network location remains unresolved |
| Browser decoding/main-thread stalls do not explain those six events | Processing 0.3–4.7 ms on affected frames; arrival-to-display 5.5–17.6 ms; maximum scheduler delay 5 ms | No demonstrated long browser task or slow affected-frame decode |

![Five observed browser mouth tails](contact.jpg)

Only the gap at 74.126 s occurred during detected returned speech; its roughly two-second RTC window also contains 1891 concealed audio samples (about 39 ms at 48 kHz). Three later-source-gap events occurred during silence; the first two events preceded detected speech. Six presentation gaps must not be reported as six speech cutoffs. All six RTC windows showed zero increase in reported packetsLost and decoded framesDropped. These counters do not rule out late delivery/recovery, upstream frame omission or timestamp discontinuities.

The owned session matched main-security worker 9. Its numeric log trace contains 91 render-batch timings, 91 submissions and 90 completions. Sampled render queues near the six gaps held 5–16 frames; adjacent batch wall times were 1277–1332 ms. This weakens an empty-render-queue explanation but cannot rule out a short unsampled underrun. Cross-machine clock skew was not independently measured.

## Mouth hypothesis still requiring a control

All ten main workers have identical mouth settings matching the isolated probe. Their idle-mouth silence threshold is normalized RMS 0.0001; browser diagnostics declare quiet below 0.001. The configured close transition is eight frames, with a two-frame silence debounce and 0.85 lock strength. Faint audio can fall below the observer threshold while exceeding the mouth gate threshold. Returned audio peaks do not measure the gate's input-frame RMS, so that comparison alone is not causal proof.

An input-only control was prepared: the same speech followed by 1.28 seconds of reproducible noise at 0, 6, 2 and 6 PCM16 units, then zeros. Six units exceeds the existing gate's 3.2768-unit threshold but remains below the observer threshold. Both start attempts failed conclusively with `ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS`. This control did not execute. No setting was changed in production.

Next evidence needed: execute that control and capture/replay the actual owned conversation's trailing input audio; obtain sender-side publication/encoding timing to separate stutter causes. Do not select a mouth threshold or add playback delay merely from these hypotheses.

## Measurement limits and correction

The [video frame callback specification](https://wicg.github.io/video-rvfc/) defines receiveTime as arrival of the frame's last encoded packet and expectedDisplayTime as anticipated visibility. Capture time is a browser estimate. The first analysis incorrectly generalized its absence from early frames; full-trace review found capture metadata on 2647 of 2773 frames. Four estimated capture-to-arrival values were negative, demonstrating clock-estimation uncertainty. Neighboring-frame changes are stronger evidence than absolute one-way timings.

The other three later stutters have 120–160 ms gaps between observed source timestamps. Without sender telemetry, they cannot distinguish unpublished frames, encoder/SFU omissions and delivery recovery. Callback delivery is best effort. Screenshots may perturb rendering. Audio quiet uses RMS hysteresis (0.005 start, 0.001 stop), sampled every 20 ms, rather than sample-exact physical speaker recording. Other frames had processing duration up to 47.8 ms; affected-frame results are not claims about all decoding.

## Artifacts and validation

- events.json: 5140 numeric/stage events, including 2773 frame callbacks.
- frame-analysis.json and gap-frame-neighbors.json: frame timing and neighboring samples.
- correlation.json and gpu-events.json: sanitized matching worker evidence.
- gap-rtc-windows.json and gap-audio-state.json: audio/video disturbance context.
- tail-rms-windows.json, contact.jpg and contact.json: post-speech observations.
- mouth-settings.json: allowlisted configuration verified across all ten main workers.
- model-probe-plan.json and model-tail-probe.py: successful capture harness; the input-only follow-up plan and capacity outcomes are documented separately.
- SHA256SUMS.json: evidence file hashes.

TypeScript and the protected preview build passed. ESLint reported zero errors and one unchanged useCallback dependency warning. Diagnostics observe timing and media metadata; they do not mutate buffering, playback, model parameters or pixels. Diagnostics remain preview-only. The owned browser session was deleted successfully (HTTP 200). The isolated GPU/boot-disk cleanup receipt and final production health are retained with the model evidence.
