# Real model and browser continuity — 2026-10-01

No production code, deployment, routing, account, key, model or GPU configuration
changed during these checks. The user said the visual issue was fixed; it was
left alone. The experimental PCM bridge remains disconnected from production.

## Isolated real-GPU result

One private staging L4 ran the same pinned model and runner images recorded in
`ahead-model-result.json`. After four warmups, one persistent generator consumed
four alternating paced/ahead synthetic native-16-kHz turns, 100 frames each.
The consumer paced video at 25 fps. Provider, LiveKit and browser were excluded.

| Mode | First audio | Largest audio interval | Audio frames retained |
| --- | ---: | ---: | ---: |
| Paced | 1,633.5 ms | 41.1 ms | 100/100 |
| Ahead | 1,457.9 ms | 41.6 ms | 100/100 |
| Ahead | 1,334.1 ms | 41.7 ms | 100/100 |
| Paced | 1,624.0 ms | 41.8 ms | 100/100 |

All PCM samples retained exact values and ordering, including the four-frame
final batch. Mean first-audio improvement was 232.75 ms. This is a small paired
sample, not proof of a 1.3-second spoken end-to-end response. The larger speedup
from the simulated model did not reproduce here. Inference call durations include
producer/consumer backpressure; they must not be labeled pure GPU compute time.

Cold warmup batches took 4,258.6, 7,307.5 and 3,046.6 ms; the fourth took
1,229.6 ms. Those are full 32-frame batches, not first-frame timings. This
supports separating initial warmup from steady conversation measurements.

The first benchmark attempt failed before measurement with runner exit 2.
Startup umask 077 made its public synthetic fixture directory inaccessible to
UID 1000. An explicit 0755 directory mode fixed the rerun. The retry reused the
same staging VM and pinned images with a shorter 30-minute stop deadline.
The VM stopped after the test; deletion of that VM and its disposable disk was
verified at 06:36:41 UTC. See `ahead-model-cleanup.json`.

## Browser result

An owned session on the existing diagnostics preview completed four synthetic
microphone questions through the actual OpenAI and public Atlas media path.
Every response completed; no JavaScript or provider errors were observed, and
session setup/voice routes returned 200. The test session was deleted with 200.
An earlier setup attempt used a missing fixture and produced silence; it was
closed and excluded, not counted as a latency result.

Measured end-of-microphone-activity to first returned audio was 3,976 ms on the
first turn and 3,619 / 3,595 / 3,618 ms on subsequent turns. These are this
headless test browser's synthetic measurements, not a claim about the user's
faster perceived response or a service latency distribution. The provider stage
includes VAD and incoming playout. Audio activity thresholds sample every 20 ms,
and quiet syllables can affect the endpoint estimate.

The browser recorded two video freezes, 198 and 246 ms. The first occurred near
15 seconds, before the first answer's returned speech; the second near 79 seconds,
after the fourth answer finished around 75 seconds. Thus neither establishes a
spoken-word cutoff. Both coincided with provider-side concealment increments;
the first also coincided with Atlas return-audio concealment. The observation
suggests a shared browser/network interruption rather than proving a model stall.
There were no decoded-frame drops, but some late/lost packets and audio concealment.
Natural pauses in RMS activity are not counted as missing speech.

Raw timing/statistics contain no transcripts, audio, keys or customer identifiers.
See `browser-continuity-events.json`, `browser-continuity-result.json` and
`browser-continuity-acceptance.json`. Reproduce the analysis locally with
`python3 docs/voice-stage-probe/browser-continuity-analysis.py`.

## Decision and remaining work

Do not promote the experimental transport based on these results. Its improvement
is smaller than the simulation suggested, and distributed interruption clearing
still needs a verified receiver-side barrier. The next targeted investigation is
a repeat browser test correlating media disturbances with local event-loop stalls
and connection statistics. Keep the production model and existing media path.
These results do not establish the cause of the user's intermittent cutoff.

Final read-only production check at 06:38:11 UTC returned 200 for demo, dashboard
and API health. All ten main workers were ready with the unchanged three image
digests; dashboard configuration and demo alias were unchanged. Evidence:
`continuity-production-health.json`.
