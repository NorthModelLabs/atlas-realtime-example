# Provider reasoning experiment — October 1, 2026

The baseline leaves reasoning effort unspecified. The candidate requests `reasoning: {effort: "minimal"}` using the same `gpt-realtime-2.1`, coral voice, prompt, 512-token cap, English transcription and 500-ms server VAD. Production is unchanged. The API acknowledged the minimal setting. It omitted the reasoning field for default sessions, so the default's internal effort is not inferred.

Three trials per setting used the same synthetic continuous question and 50-ms realtime-paced PCM over WebSocket. Ordering was default/minimal, minimal/default, default/minimal. All six recognized the question and answered two plus two correctly in English. Results include end-of-speech detection, provider generation and network transport; they exclude Atlas and browser playback.

| Setting | First audio after final voiced sample | Response created to first audio |
| --- | --- | --- |
| Default | 1358, 1755, 1360 ms | 600, 675, 653 ms |
| Minimal | 1168, 1245, 1139 ms | 460, 535, 429 ms |

This small sample supports preview testing, not a latency guarantee or broad quality equivalence. The unusually late second default VAD event contributed to that trial's end-to-audio difference; the post-created stage also improved in each corresponding minimal trial. The prompt, VAD and provider model are not changed together.

The protected candidate is `dpl_AFYAoAGrNJHNRzcmriNhdCFxStAz` (`demo-atlas-rkavg3wma-north-model-labs.vercel.app`), with numeric diagnostics explicitly enabled. It passed TypeScript, six existing tests and the Vercel build. Browser acceptance below passed; no public alias has yet been reassigned.

Official references: https://developers.openai.com/api/docs/models/gpt-realtime-2.1 and https://developers.openai.com/api/docs/guides/voice-prompting describe configurable reasoning and its latency tradeoff. Those docs motivate the experiment; the measured results decide acceptance.

## Buffering inspection boundary

Automatic approval review rejected export of the full deployed runner source. The safer approved read performed AST inspection inside the container and returned only relevant setting names and scalar defaults, plus the already-known hash. A second read returned only explicitly allowlisted non-secret settings from the running dispatcher process. On worker 0, speech prefetch is enabled, silence gate is disabled, audio queue maximum is 32 frames, and the runner mode is in-process. These are actual flags for the checked process; defaults and effectiveness must not be confused. The owned earlier session still reported 32-frame context-window submissions. No worker configuration or image was modified.


## Full browser comparison

Candidate and unchanged baseline (`demo-atlas-o5xyjkl7r-north-model-labs.vercel.app`) each completed four spoken questions in one established session. Both used the same looping synthetic microphone fixture, isolated headless Chrome, public default face and numerical diagnostics. No screenshot was taken during the measured intervals; a candidate screenshot was taken afterward. This is a sequential small sample, not randomized population testing; different allocated workers/network conditions can affect the Atlas stage.

| Median of four turns | Baseline | Minimal reasoning candidate |
| --- | --- | --- |
| Final voiced microphone sample → provider audio | 1568 ms | 1272 ms |
| Browser audio bridge | 21 ms | 13 ms |
| Outgoing Atlas audio → returned audio | 2201 ms | 2112 ms |
| Final voiced microphone sample → returned audio | 3779.5 ms | 3404.5 ms |

Candidate full-path range: 3265–3485 ms; baseline: 3712–3793 ms. Individual stage medians need not sum to the end-to-end median. Samples indicate a modest improvement; they do not achieve the roughly 1.3-second whole-conversation target, nor imply the production model takes three seconds to infer a frame. RMS sampling is about 20 ms and is not a perceptual audio-quality metric.

Additional typed candidate checks retained a blue-color fact across turns, asked for clarification on “Can you fix it?”, and obeyed “Say only hello.” after counting. That last request arrived too late to establish a reliable interruption-latency measurement; interruption acceptance remains open. All observed responses stayed in English. Both browser runs had zero JavaScript errors; config/session/share/voice requests succeeded. The candidate UI disconnect ended its session (authoritative API status `ended`); the harness's redundant second delete returned 409. The baseline's owned session delete returned 200. No other session was touched.

The metadata-only source inspection found the prefetch-enable reference inside a branch controlled by segment-lifecycle state; the checked process had no segment-lifecycle override, and its verified source default is false. This is an actionable configuration lead consistent with the owned 32-frame batches, not permission to change production batching or a proof that enabling it is safe. No source bytes were exported by these checks.
