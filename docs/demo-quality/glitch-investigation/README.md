# Intermittent demo freeze investigation — 2026-10-01

Status: reproduced and localized further; root cause and fix are not established.
No deployment, model settings, latency/batching behavior, routes, customer records,
keys, or production GPU images were changed for this investigation.

## New evidence

The retained owned synthetic conversation recorded on the existing protected
preview contained two receiver-confirmed video freezes. This is additional
analysis of that cleaned-up session, not a new live test or production health check.
The original capture started at 2026-10-01 19:35:56.401 UTC.

| Capture time | Browser freeze duration | Frame receive gap | Decode time | Main-thread scheduling delay |
| --- | ---: | ---: | ---: | ---: |
| +9.025 s | 195 ms | 259.9 ms | 1.5 ms | 7 ms |
| +48.641 s | 198 ms | 247.3 ms | 2.1 ms | 8 ms |

The first occurs before the first returned speech. The second is **during returned
speech**: the audio observer becomes active at +48.546 s and remains active until
+48.886 s. Audio activity alone does not establish intelligibility or a missing word.

Both video gaps have a 200 ms RTP timestamp jump and a single presented-frame
increment. Neither surrounding counter window has increased video packet loss,
NACKs, or decoded-frame drops. Both have returned-audio concealment increments.
No main-thread long task was observed in either gap window; the audio context was
running and the document visible. This argues against a JavaScript/UI stall or
slow browser video decoding for these two events. It does **not** distinguish a
sender/rendering pause, SFU delay, or delayed network packets. Lack of reported
packet loss does not mean packets arrived on time.

The +48.6 s window also contains provider-side audio concealment; the first does
not. Earlier observations suggesting a shared browser/network cause therefore
remain a hypothesis, not a confirmed explanation for all glitches.

A third 949.9 ms frame-callback gap at +115.318 s is a different case: it overlaps
a 939 ms main-thread long task, skips 24 presentation callbacks, and has **no**
increment in receiver freeze count or returned-audio concealment. It occurred
after the 100-second recording, during the diagnostic export period. It must not
be counted as another verified media freeze or evidence against the model.
The available data do not identify the exact task responsible for this long task.

## Existing production runner logs for this owned session

Read-only Cloud Logging queries identified the already-ended owned session on
`avatar-pasteback-main-security-6`. The exact 19:35:58–19:36:49 UTC query returned
141 records, below its 450-record cap. Only numerical diagnostic fields were
retained in `numeric-runner-window.json`; session, room and participant identifiers
are omitted.

Around both freezes, batches reported all 32 frames, with sampled render queues
of 6–8 frames and normal batch wall durations around 1,300–1,348 ms. Those durations
include producer/consumer backpressure and are **not pure GPU compute measurements**.
There are brief audio-queue backpressure records; they do not establish a cutoff.
No drop/error diagnostic records appeared in this bounded session-filtered window.
The sparse snapshots cannot prove the render queue stayed nonempty between them,
nor can they prove every frame was published on schedule. They do not justify
changing the model, queue sizes, buffering, or batch behavior.

## Reproduction and evidence limits

Run the analysis on the private raw numeric fixture:

```sh
python3 docs/demo-quality/glitch-investigation/analyze.py \
  /private/tmp/atlas-returned-av-20261001/diagnostics.json \
  --origin 1790883356401 \
  --output /private/tmp/glitch-correlation.json
```

`returned-av-correlation.json` contains the original source SHA-256 and calculated
windows. `numeric-event-windows.json` retains bounded numerical events sufficient
to inspect the three reported gaps without audio, transcripts, or credentials.
The analyzer rejects ambiguous simultaneous inbound streams and reset counters;
it does not silently combine reconnect epochs. Its causal labels describe observed
evidence only.

The observer measured one-second counter windows. Browser event-loop callbacks
and receiver stats run on different schedules. The input was synthetic and the
browser/headless network path was not the user's browser. The video freezes are
real measurements of this test; a missing spoken word is not established.

## Next decisive check

Use one owned synthetic session with synchronized, numeric-only timestamps at:

1. renderer output enqueue/yield;
2. server-side RTC frame capture/publication;
3. browser frame reception/presentation and audio concealment.

Measure gaps and monotonically increasing frame counters on the **same unchanged
pinned runtime**, in an isolated staging reproduction first. Keep samples in a
bounded in-memory ring; export after the session to avoid an export-induced stall.
Include explicit normal shutdown and account for every produced frame, so sender
interruption cannot be mistaken for dropped model output.

A sender gap establishes which local stage stalled. Continuous sender output with
a receiver gap redirects investigation to transport/SFU. Existing batch totals
cannot make this distinction. This is a continuity investigation only; it does
not authorize latency, batching, mouth-control, or model changes.

### Prepared staging observer

`staging_frame_timing.py` is an opt-in, instance-only wrapper of the existing
`_enqueue_stream_frame` method, guarded by the preserved runner source SHA-256.
It observes **decoded frame handoff**, not the first HTTP byte or GPU completion.
The method-return marker is not proof of enqueue if the original method rejects
a stale generation. It delegates the original objects unchanged and preserves
exceptions/cancellation. No model, runner image, or default application integration
was changed.

The hook retains at most 30,000 numeric events/120 seconds by default, with hard
limits of 50,000/180 seconds. Limit exhaustion disables observation only. Close it
after producers stop, then export to an exclusive mode-0600 file. Exporting during
the live conversation is intentionally refused. Five tests cover object identity,
restoration, cancellation, bounded observation without lost media calls, private
exclusive export, and runtime mismatch rejection.

For the current **direct** staging model replay, wrapping the enqueue method adds
useful inter-frame handoff timings but cannot measure actual browser continuity.
The minimum full-path check needs one isolated runner plus the existing staging
media infrastructure, one isolated room and one owned browser participant, with
synthetic microphone speech through the same provider path. The parent harness
must mark the real RTC `capture_frame` call boundaries, not call generator-yield
marks "publication." Successful capture return means RTC acceptance, not packet
transmission. Pair these markers with a monotonic caller frame counter and final
full frame accounting. Export the browser and runner observations only after
recording stops. No production instrumentation or live customer rooms are needed.
