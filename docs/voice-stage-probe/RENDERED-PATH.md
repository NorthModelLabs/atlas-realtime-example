# Rendered audio path investigation — 2026-10-01

The isolated test now includes the exact runner and installed SDK, LiveKit audio
streams, AvatarRunner, AVSynchronizer and returned WebRTC audio/video. Model
responses are simulated; neither result is real-model or browser E2E latency.
All participants use a disposable private-network server. No production runtime
or customer account was changed.

## Finding and candidate

With 24-kHz segments sent directly into the existing renderer, a 10-ms synthetic
tone produced no voiced output. A later 400-ms segment yielded nine 40-ms voiced
frames, and a subsequent 2-second segment yielded 51 rather than 50 frames. These
measurements are consistent with resampler/frame-buffer residue crossing segment
boundaries, but do not by themselves prove the cause of a public-demo cutoff.

The CPU-only candidate `experiments/pcm-bridge/pcm_frames.py` converts each turn
to native 16-kHz mono, explicitly flushes the resampler, and pads only the final
partial 40-ms video frame. It resets conversion state on cancellation. It does
not change the GPU model, generator source, image digests or renderer flags.

After this change, the 10-ms input returned one audible 40-ms frame (30 ms of
padding); the 400-ms input returned ten frames; every 2-second input returned
50 frames. The observer received audible audio and video for all five cases,
and connections remained active between turns. This is a duration/media-presence
check, not bit-exact comparison after lossy WebRTC encoding.

| Two-second input | First pre-encode audio | Largest pre-encode interval |
| --- | ---: | ---: |
| Paced, with candidate framing | 1,618.1 ms | 119.1 ms |
| Ahead, candidate trial 1 | 836.0 ms | 80.1 ms |
| Ahead, candidate trial 2 | 730.6 ms | 40.7 ms |

The full media path's pacing differs from earlier stand-alone generator
simulations. Do not treat these numbers as GPU measurements or add them to a
provider number and claim a measured end-to-end result. Long gaps still require
real-model and browser continuity checks.

Baseline build `ca4f2ecf-00d9-4f2d-b0ce-53dd02422d5e` completed as a process,
but its media acceptance result was **false** for the short input. The framed
candidate build `db8cc3ad-e973-42a8-a355-b76401245288` passed all five reported
media/duration checks. See the adjacent `rendered-*.json` and probe source files.
Use the private pinned LiveKit config from the earlier wire test, copy the
chosen probe as `probe.py`, the public face fixture as `face.jpg`, and for the
candidate also copy `pcm_frames.py`. No production credentials are required.

Remaining: real-model paired measurements, full distributed cancellation
acknowledgement, stall behavior, and warm microphone/provider/browser trials.
The existing media path remains the public default.

## Conversion contract

Pinned-SDK build `938c9328-ebdd-4151-831a-f8e83a5016f3` passed four tests:
arbitrary input chunk sizes/partial tails, filter-state reset on cancellation,
sequential turn reuse, and empty/invalid input. Eight durations from 1 ms to
2.013 s retained the exact expected resampled sample count. Only the final
partial 40-ms frame was zero-padded; pending buffer size stayed below one frame.

The first test revision incorrectly demanded bit-identical samples from two
independent native resamplers. Observed sample values differ by at most two
PCM16 least-significant bits; the revised assertion measures that bound while
keeping count/order and zero padding strict. This is not a claim of bit-exact
resampling. See `pcm-frames-sdk-result.json` and
`experiments/pcm-bridge/sdk-tests/frames_contract.py`.

Production health was rechecked at 06:17:51 UTC: demo, dashboard and API health
returned 200; all ten main workers were ready with preserved digests; routing
and deployment assignment were unchanged.
