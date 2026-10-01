# Returned audio/video mouth-tail evidence

The live-demo mouth tail is reproduced; its root cause and fix remain unconfirmed. The dashboard/API/queue rollout being complete does not establish this visual issue is fixed.

An owned synthetic conversation recorded returned audio/video together for 100 seconds, while separate observers retained decoded provider and returned PCM. Five complete responses were reviewed. Two remained visibly open at approximately +400 ms after the recorded-audio reference, then closed or nearly closed at +800 ms. Three settled earlier. No late reopening at +1,400 ms was apparent in these sampled turns; an earlier capture showed that separate behavior.

The reference is the last 10-ms RMS window above 0.001, not an exact phonetic endpoint. Low-level audio continues after it. Provider PCM stays above 0.0001 for roughly another 420–530 ms. That makes residual audio and the existing mouth-close envelope plausible contributors, but provider PCM precedes outgoing Atlas transport and cannot prove the model's exact input.

## Integrity and limits

- Returned recording contains 2,498 video frames through PTS 99.887; video and audio use the same MediaRecorder timeline. Audio starts at PTS 0.075.
- Both raw observers account for all flushed samples, with one initial 512-sample gap (~10.7 ms at 48 kHz) around 0.2 seconds. There are no later recorded gaps. The response windows occur later, and contact frames use the recording's actual PTS rather than raw observer wall time.
- The independently recorded audio envelope agrees with raw returned PCM (cosine similarity 0.9903, best alignment -10 ms). MediaRecorder re-encodes Opus, so raw PCM remains the source for low-level signal inspection.
- These are synthetic prompts and an owned test session. The session was deleted with HTTP 200. No existing customer session was stopped.
- Captured source and raw audio remain private under `/private/tmp/atlas-returned-av-20261001`; retained contact images and numerical evidence are included here. These stills do not prove absence of micro-motion between samples.
- This is not a latency benchmark, model replacement, or candidate acceptance.

## Next discriminating experiment

Replay the complete seven-second provider response/tail from turn five using the preserved model and runner images on an isolated staging L4. Compare close-frame count 8 → 2 → 8, keeping silence threshold, debounce, strength, eye settings and audio unchanged. Run normal and quiet speech. Use the original runner's resampler with complete flush accounting, retain exact model-input and paired output hashes, and inspect consecutive tail frames as well as voiced samples.

This direct replay can isolate the effect of the closing envelope. It still cannot prove full browser/transport acceptance; a successful candidate would need that follow-up before promotion. No mouth change has been deployed.
