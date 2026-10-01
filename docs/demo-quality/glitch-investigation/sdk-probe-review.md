# Local compatibility review — 2026-10-01

No cloud resources, network rules, deployments, accounts, or image pins changed.
This is executable probe preparation, not a passed native runtime/fullpath test.

## Evidence and corrections

Downloaded version-pinned published wheels into sdk-evidence, verified their
published SHA256, and inspected their source without installing or executing the
native libraries. Versions livekit 1.1.5 and livekit-agents 1.5.2 correspond to the
previous isolated exact-image import check documented in SEGMENT-CONTRACT.md.

AVSynchronizer in that SDK has instance audio/video sources. Video push only
enqueues a frame: its separate capture task applies FPS pacing before calling
VideoSource.capture_frame. Audio push awaits AudioSource.capture_frame. Thus
observing push alone cannot establish sender continuity. SourceTiming now wraps
these individual source objects plus push, restores all three instance methods,
and preserves frame object identity, return values, exceptions, and cancellation.

The earlier preparation incorrectly instantiated stock AvatarRunner and explicitly
set receiver frames to 40ms. Existing retained runner source uses _HQAvatarRunner
(explicit H264/bitrate) and DataStreamAudioReceiver with its 100ms default and
rpc_max_retries=0. worker.py now uses the original image's own _HQAvatarRunner,
refuses its absence, preserves receiver defaults, and limits sender_identity to
our owned participant. Retained source git-image-runner.py has SHA8e87ce6a…,
NOT the runtime file SHA55807a14…: the reference supports this correction but is
not a substitute for checking the actual pinned image's class/settings at run time.
The worker retains the exact runtime-file hash guard and never substitutes code.

Cleanup attempts runner close and room disconnect independently, awaits the
SDK video task after cancelling, restores hooks, and flags cleanup errors as
incomplete evidence. Browser capture explicitly flags event-cap truncation.
The final drain remains unproven: exclude shutdown boundaries from conclusions.

## Tests actually run

- Six tests execute the actual SDK AVSynchronizer queue/task/FPS code with native
  FFI frame/source objects substituted only for local testing: preserved identity
  and order, queued input without publication, source exception propagation,
  cancellation, hook removal, audio identity. All pass.
- Two compact-export tests: locate a synthetic 240ms gap in a 15,000-event trace,
  preserve truncation indication, enforce exclusive mode0600 and <90KB output,
  and distinguish an empty trace from a passing capture. Both pass.
- Python compile and Node syntax checks pass.

These tests do not validate native SDK FFI assignment, H264 negotiation, browser
playback, model initialization/warmup, or container networking. Those remain
bounded staging-run requirements, using the unchanged exact images/configs.

## Minimum observables and interpretation

Use one worker monotonic clock for decoded-frame handoff, synchronizer input,
and RTC capture begin/end; retain event counters in independent sequence domains.
Use browser receive/presentation times, RTP timestamps, decoded frame/freeze/loss
counters, audio concealment and scheduler/long-task data. Align clocks only with
measured uncertainty; host wall clocks alone cannot prove sub-frame causality.

1. A decoded-frame gap that propagates through capture and receiver during active
   speech implicates the path upstream of decoded handoff. It does not distinguish
   model compute from model HTTP delivery/decoding by itself.
2. Continuous decoded handoff with a capture gap narrows investigation to runner
   buffering/pacing/event-loop or SDK source acceptance. Check enqueue blocking.
3. Continuous capture with a browser receive gap narrows it to encoder/RTC sender,
   SFU/network, or receiver transport. Capture return is NOT a packet-sent marker:
   exact sender-versus-transport attribution additionally needs sender encoded
   frame/packet timestamps or equivalent SFU ingress/egress evidence in the same
   interval. One-second aggregated counters may miss a 200ms pause.
4. Regular receive timestamps but presentation gaps plus a long task identify a
   browser presentation issue; do not label it GPU/model delay.

No speculative fix is justified yet. The prior two ~200ms receiver freezes are
real observations; their source remains unresolved. The separate ~950ms export
long task is not proof of a media receiver freeze.

## Export budget and runtime blockers

Keep full numeric traces private on the source disk. After producers stop:
`python compact_timing.py /evidence/worker.json /evidence/worker-summary.json`
exports a capped <90KB numerical summary with only four worst gap windows/stage.
Do not base64-export media or multi-megabyte archives over serial. Summary alone
is not sufficient when exact event alignment is disputed; retrieve selected
small event windows later.

Existing shared isolated media backend is TERMINATED and its media firewall
source SA differs from parent's worker. Its historical managed trace handling
also requires care with browser query JWTs. Do not start or modify that shared
backend. PLAN.md instead prepares an ephemeral private SFU on an already-owned
staging host after the parent's GPU replay; it still requires that runtime run.
This local replay excludes live provider and WAN. A negative result would not
clear the user's intermittent production report.
