# Browser scheduling and matching worker — October 1, 2026

A protected preview adds numeric browser scheduler, audio-context and jitter
buffer counters. `NEXT_PUBLIC_VOICE_DIAGNOSTICS` gates the probes; production
remains on its existing diagnostics-disabled deployment. No audio handling,
provider configuration, model, GPU image, account or key changed.

TypeScript and the Vercel preview build passed. The existing synthetic microphone
fixture completed four responses through the real provider and Atlas path.
There were no JavaScript/provider errors; config/session/share/voice returned
200. The single owned session was deleted with HTTP 200 after the measurement.

## Browser results

Across 87 scheduler samples, the maximum 50-ms timer delay was 9 ms. No long
main-thread task was reported. The document stayed visible and AudioContext
stayed running. This run had no video freezes or decoded-frame drops. Some
packet loss and audio concealment occurred, so this is not proof that all
intermittent playback issues are fixed. No subjective audio-quality verdict is
inferred from successful captions.

Mean provider audio jitter-buffer residence was 138.1 ms, compared with a
132.4-ms target and reported minimum. Atlas return audio measured 117.9 ms,
with target and minimum both 117.7 ms. The near-equal target/minimum values give
no evidence of an unnecessarily large application-requested buffer in this run.
They do not prove that these minima are unavoidable on every network. Preserve
default buffering rather than claiming that a lower hint fixes the stutter.

The W3C [statistics definitions](https://www.w3.org/TR/webrtc-stats/#dom-rtcinboundrtpstreamstats-jitterbufferminimumdelay)
explain the minimum as excluding application and synchronization influences;
averages here use counter deltas divided by emitted sample/frame count.
Concealment means locally synthesized replacement samples; it does not by itself
prove a model dropped speech. Counter increments are reported in approximately
one-second windows, not precise packet-loss timestamps.

Measured end-of-microphone-activity to returned audio was 3,510 / 3,454 / 3,550 /
3,394 ms. These are a small synthetic headless-browser sample and not a claim
about the user's perceived delay. The provider stage was 1,254–1,392 ms including
VAD and playout; the browser bridge was 18–40 ms; the Atlas portion was
2,099–2,162 ms. The approximately 1.3-second whole-path goal remains unachieved.

## Matching worker evidence

A read-only log search located this exact owned session on main-security worker
5. Logs were filtered to that session; committed artifacts retain only numeric
metrics and stage names, excluding room, session and batch identifiers, paths,
addresses and other sessions. This is stronger linkage than comparing unrelated
GPU benchmarks with browser timing.

The worker reported one 1,322-ms startup warmup and 76 subsequent 32-frame
batches. Whole-batch wall time ranged from 1,296 to 1,351 ms (median 1,316).
Submission queue delay had median 1,224 ms and maximum 1,322 ms. Reported input
lag had median 1,315 ms. Ten released speech-backpressure waits ranged from
1 to 132 ms (median 25). These are wall-time/queue metrics, not isolated GPU
kernel execution. Absence of an underrun log is not proof of absent underruns.

This identifies batching/queueing as a substantial measured part of the path.
The next experiment should target that delay in isolation, preserving the pinned
model and testing continuity. A previous first-small-batch candidate introduced
a gap before the next batch; it must not be promoted merely for an earlier first
frame. The current ahead-PCM prototype also remains undeployed and still lacks
its full distributed cancellation acceptance.

## Evidence and limits

- `scheduler-events.json`, `scheduler-result.json`, `scheduler-analysis.py`:
  numeric browser events, result and reproducible counter analysis.
- `scheduler-owned-gpu-events.json`, `scheduler-owned-gpu-result.json`:
  sanitized metrics from the matching owned production test session.
- `scheduler-acceptance.json`, `scheduler-preview.json`: app acceptance and
  preview identity/cleanup receipt.
- `scheduler-production-health.json`: public demo/dashboard/API health 200,
  all ten main workers ready on original digests, unchanged dashboard and demo
  assignment at 06:43:00 UTC.

The earlier run's video freezes did not reproduce, so their cause remains
unconfirmed. This run contradicts a persistent main-thread stall explanation in
this test browser; it cannot exclude stalls or worse networks on other clients.
