# Exact-model isolated timings — October 1, 2026

The warmed main model delivers first frames quickly. Seven late requests returned the first frame in 401.6–407.1 ms and all 32 frames in 1291.9–1302.8 ms. A whole 32-frame stream duration must not be described as time to the first frame. These local model-only measurements exclude audio collection, provider response time, browser bridging, transport and playback.

The test used the immutable production main model digest `f853fbd1dc92ae7a514e93107e3696e8009f74e929180ac361e2e28e9d52e7e4`, the captured production model environment and equivalent 14-CPU/32-GiB container limits on one isolated L4. No production worker, model image, configuration, account or key changed. A single public face and synthetic 32-frame audio input were reused. The first four calls all requested 32 frames; then the requested cap changed to 8 and 16 while input bytes and cache key stayed fixed.

| Request | First frame | Complete stream | Actual frames |
| --- | --- | --- | --- |
| First 32-frame call | 3443.2 ms | 4333.6 ms | 32 |
| Second identical call | 6524.1 ms | 7413.7 ms | 32 |
| Third identical call | 2229.6 ms | 3112.5 ms | 32 |
| Fourth identical call | 401.6 ms | 1291.9 ms | 32 |
| Three requests capped at 8 | 405.3–407.0 ms | 1297.9–1300.9 ms | 32 each |
| Three requests capped at 16 | 404.2–407.1 ms | 1299.2–1302.8 ms | 32 each |

All streams ended normally and passed binary RGB frame-size validation at 1024×1024×3. The 8/16 requested caps did not reduce actual frame count for this 32-frame input. This explains the earlier harness's frame-count assertion; it is not evidence of a broken production model. OpenAPI confirms the submitted field names are supported, but the observed behavior is authoritative. No lower-cap optimization is accepted based on these results.

The early timings demonstrate that one completed initial request did not immediately produce stable latency in this fresh-container test. They do not by themselves identify compilation, cache work or another cause. The user may experience faster established conversations; these measurements support distinguishing initial work from steady operation. Seven later requests at similar timings are still a small synthetic sample, not a p95 guarantee.

The guest completed all ten cases and shut down. Its monitor confirmed TERMINATED at 03:26:15 UTC, with the same owned VM ID 5752044785369117268. The disk is retained for a bounded follow-up using genuinely shorter audio inputs and a real-inference test of the already-built warmup-controller candidate. No second VM is needed. The ~1.3-second whole-conversation target is not proven by this model-only result.


## Repeat with genuinely shorter inputs

The third run reproduced the initial-to-warmed transition. Four identical 32-frame inputs gave first-frame times of 3590.7, 6495.6, 2275.7 and 397.4 ms. Four genuinely 8-frame audio inputs then gave 396.8–426.1 ms; four 16-frame inputs gave 397.6–416.4 ms. All returned 32 valid RGB frames with end markers. Changing both input duration and requested cap did not reduce output frame count. No production chunk-size change is justified by these results.

The nine later requests completed their full streams in 1250.1–1279.4 ms. This is consistent with fast warmed inference; it is not 1.25 seconds to first frame, and it excludes the rest of a voice conversation. The several slower initial calls recur in this fresh-container experiment; the internal cause has not been established.

## Warmup candidate inference acceptance

The exact built dispatcher candidate `7236e4d3214079381380859b3c6099b5d719f68b129c73086e3e88e63b333004` ran its warmup method against the isolated exact main model. Source and public-face fixture hashes matched the reviewed candidate. Three calls succeeded in 2003, 1362 and 1321 ms; each stream contained 32 validated frames and its end marker.

This checks actual inference from the candidate method after the model benchmark. It does not test a cold full-controller startup, sustained cancellation/session switching in production, or an end-to-end latency improvement. Earlier in-image tests independently cover cancellation, busy-session skipping, idle resumption and shutdown. No production dispatcher or model has been changed.

Compute confirmed the same owned VM stopped at 03:36:00 UTC. At 03:37:26 UTC all ten main-security workers were ready with unchanged avatar/dispatcher/sidecar image IDs, and demo/dashboard/API health returned HTTP 200. These checks establish readiness and public HTTP availability, not every customer workflow or continuous availability.

Cleanup completed at 03:38:42 UTC. The exact owned staging instance and its disposable boot disk both returned 404 after the successful delete operation. The staging probe leaves no running GPU or retained disk. See isolated-model-cleanup.json.
