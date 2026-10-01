# End-boundary investigation — October 1

**Symptom reproduced again; no remedy deployed.** Fifteen reviewed screenshots span five quiet transitions. The clearest late reopening is turn 2: mouth appears closed at +844 ms, then open again at +1452 ms. Turn 4 is still slightly open at +863 ms and closed at +1467 ms. This is more than a single initial settling frame. The screenshots are sparse; times are relative to the browser returned-audio RMS observer, not a manually annotated last phoneme.

## What changes the next action

In the windows surrounding these images, decoded provider and outgoing browser audio peak RMS is about 0.00000286, below the production silence threshold of 0.0001. Returned audio around the turn-2 reopened frame peaks at 0.0000922, also below that threshold. Other returned windows briefly cross the threshold. These are browser measurements, **not actual normalized model-input PCM**, and input/output observations at the same wall-clock time describe different stages. They do not prove a particular model defect. They do show that trimming the already-quiet provider source is not an established remedy for the late reopening. Full transport/model-input capture is the next discriminating test; another upstream threshold patch is not justified.

See `contact.jpg`, `frames.json`, `frame-envelope-windows.json` and numeric `events.json`. Cropped images retain the avatar region and omit captions. The reviewed images retain the human appearance; this is not a universal expression guarantee.

## Boundary metadata experiment

The provider event observer retains event types and top-level field names only. The observed `response.output_audio.done` carries response/item identifiers and output/content indexes, without a last-sample timestamp. The observed `output_audio_buffer.stopped` similarly lacks an audio sample boundary. No `response.output_audio.delta` messages were observed in these WebRTC conversations. This is consistent with the [official WebRTC audio guide](https://developers.openai.com/api/docs/guides/realtime-conversations#client-and-server-events-for-audio-in-webrtc); it is an observation of this path, not a claim that all transports lack sample control.

A numeric-only `RTCRtpScriptTransform` observer was attached to the provider receiver and initialized its worker successfully, but received **zero encoded frames** while receiver counters showed 5,866 packets and 5,637,600 decoded samples. Chrome version: 154.0.8037.92. Reattaching the observer during the same owned session still yielded no frames; the old transform reported failure when detached. The outcome resembles the [reported Chromium bidirectional-transform issue](https://github.com/w3c/webrtc-encoded-transform/issues/314), but that report concerns a different version/topology detail and is not proof of the exact browser defect here. Zero observer frames are not evidence of silence. Receiver synchronization-source observations exposed timestamps but no `audioLevel` value.

The observer forwarded each frame unchanged if invoked; it did not implement filtering, frame replacement, buffering or an audio remedy. Two owned diagnostic sessions were deleted with HTTP 200, and their isolated browsers closed. A separate local oscillator loopback could not establish a connection, including with public STUN, and therefore did not validate the observer. Its failed connectivity says nothing about the production avatar path.

## Closure-only hypothesis

`closure-comparison.json` evaluates the hash-verified production mouth-envelope helper against the existing synthetic speech fixture. The baseline is close/open/debounce = 8/4/2 frames. A local candidate of 2/1/4, with the silence threshold unchanged, avoids adding closure on above-threshold frames and shortens settling after a zero tail. It still leaves a two-second above-threshold residual tail open for over two seconds, and increases closure on 7–10 below-threshold fixture frames depending on gain. It is therefore **not accepted as the root fix**, has not been rendered or deployed, and does not warrant a production setting change.

The comparison uses the same earlier approximate linear resampling, not the real runner resampler. Reproduction requires the hash-verified source helper and the existing private synthetic fixture path noted in `closure-comparison.py`. No source code from a live production worker was exported by this check.

## Required next evidence

Capture actual decoded/normalized PCM entering the renderer during an owned full-transport conversation, paired with returned audio/frame timing. Retain bounded private PCM and complete segment/drain accounting for replay; prior synthetic queue tests alone do not identify where this late reopening originates. Compare exact input with a speech-preserving control before choosing a remedy. Preserve all original production GPU/model image digests, customer records/keys and current fast audio behavior.

## Final production guard

At 18:26:16 UTC, all ten main workers were ready on the original three image digests, demo/dashboard/API health each returned HTTP 200, and the public demo alias and dashboard snapshot were unchanged. See `release-health.json`. Both owned conversations and their browsers were cleaned up; this investigation created no GPU resource or production change.
