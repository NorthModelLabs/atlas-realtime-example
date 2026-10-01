# Exact-runner CPU batching rehearsal — October 1, 2026

The existing prefetch setting does not, by itself, give the deployed configuration an eight-frame speech start. In an isolated CPU test of the exact deployed runner, enabling segment lifecycle and silence detection together admitted an eight-frame first speech batch about 280 ms after speech began. Preserving the remaining speech also required tail flushing. This is a candidate for full isolated transport/model testing, not a production configuration recommendation yet.

## Production baseline and isolation

A read of seven allowlisted, non-secret timing settings from each of the ten main-security dispatcher processes found the same overrides: video FPS 25, audio queue maximum 32, prefetch enabled, silence gate disabled, and no segment lifecycle override. The verified runner source defaults segment lifecycle and tail flushing to disabled. Image/source pins:

- Dispatcher: `830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee`.
- Runner source: `55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec`.
- Avatar model remains `f853fbd1dc92ae7a514e93107e3696e8009f74e929180ac361e2e28e9d52e7e4`.

Cloud Build ran the already mirrored immutable dispatcher in the isolated staging project, with container networking disabled, read-only filesystem, no capabilities, two CPUs, four GiB memory and a five-minute job timeout. No image was built or deployed, no GPU was allocated, and no production configuration, customer account or key was changed. No production source was exported: the fixture imports and exercises the runner inside its existing image.

The public demo face initializes the runner. Synthetic mono 16-kHz input contains 50 voiced 40-ms frames, preceded by 0, 8 or 20 silent frames and followed by 30 silent frames. Each phase runs twice. The real input queue, audio chunking and inference loop execute; the GPU request is replaced by an immediate stub recording submitted audio-frame counts. Idle inference is also stubbed. Therefore this isolates admission/batching behavior and excludes inference time, rendering backpressure, video, transport and playback.

## Results

| Configuration (prefetch enabled in all rows) | First speech submission after first input frame | Submitted voiced frames out of 50 |
| --- | --- | --- |
| Current: segment off, gate off, tail flush off | 440.5–1241.8 ms | 50 |
| Segment on, gate on, tail flush off | 280.7–281.5 ms | 40 |
| Segment on, gate on, tail flush on | 279.9–281.7 ms | 50 |

The current path's timing depends on where speech begins within a continuous 32-frame block. Eight input frames at 25 FPS arrive from t=0 through approximately t=280 ms; this is why the recorded interval is 280 rather than 320 ms. These are first **submission** measurements, not first returned frame or whole-conversation latency. For this fixture, the candidate saved approximately 160–960 ms of admission delay.

An initial additional case enabled segment lifecycle without enabling the silence gate. It used its eight-frame prefetch on leading silence and submitted the first voiced batch after about 761 ms, slower than the corresponding current-settings case at about 441 ms. Changing only the segment flag is therefore rejected by this test.

The gate/segment combination without tail flushing submitted only 40 of the 50 voiced frames. The complete flag combination submitted all 50 in each of six cases; the final request contained ten voiced plus eight trailing silent frames. Counts alone do not establish sample identity, correct output video, gap-free playout, or behavior under real inference backpressure.

## Evidence and reproduction

- Initial safe signature/source check: build `f993488f-feac-43f9-8739-e0db380811c7`, SUCCESS.
- Initial eight cases: build `20b59214-a63a-4cc9-b89a-5a996fccf77e`, SUCCESS; `runner-batching-initial.json`.
- Eighteen phase/tail cases: build `a5d7a741-3d37-4978-a0cb-482ebe19480b`, SUCCESS; `runner-batching-phases.json`.
- Reproducible harness: `runner-batching-cpu-probe.py`. Run it inside the pinned staging mirror `us-central1-docker.pkg.dev/atlas-stg-isolated-20260831/atlas-stg-runtime/voice-warmup-base@sha256:830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee`, mounting it as `/probe/probe.py` and the repository's `public/faces/enterprise-b1450303.jpg` as `/probe/face.jpg`, with networking disabled. The script asserts the exact runner source hash before testing. It changes Python module flags only inside that disposable process.

## Remaining acceptance

Before any production consideration, exercise the actual stream decoder/render queues against the model's observed 32-frame output contract, including sample order, short utterances, tails, interruption and inference backpressure. Then run a bounded isolated full-model/transport rehearsal and compare warm spoken turns with the existing demo baseline. Short input requests previously still produced 32 model frames; the CPU submission improvement does not prove that output contract will preserve continuity or reduce browser-return latency. The approximately 1.3-second whole-conversation target remains unproven.

## Real decoder and audio pairing follow-up

CPU build `7b3f3e79-fd93-4d07-b04c-c041cf80c1a4` succeeded using the same exact runner. This test exercises its real `_run_inference_streaming`, binary decoder and render queue against a synthetic 32-frame server response fragmented across record-header boundaries. Requested output sizes of 8, 16, 18 and 32 all enqueued exactly that many paired video/audio frames. Unique PCM values per input frame verified byte-for-byte preservation and order, not only total frame count. See `runner-decoder-contract.json` and `runner-decoder-cpu-probe.py`.

The short cases closed the response before the synthetic server's end record. The 32-frame case reached the end. The server generator started yielding the next record before the short-case decoder exited; this is not evidence that an extra video frame was enqueued. Thus the client can consume a prefix correctly, but we still must validate how early response closure interacts with the real model's request lifecycle and motion cache. The synthetic test cannot prove that cache continuity or GPU scheduling remains correct.

At 04:48:32 UTC, a fresh read confirmed all ten main workers ready with the original three image hashes, unchanged dashboard snapshot and demo deployment alias, and HTTP 200 from demo, dashboard and API health. All CPU builds are terminal SUCCESS. No new browser call was made in this investigation, and no staging GPU exists as a result of these CPU tests.

## Bounded real-model rehearsal plan

One new disposable staging VM, `atlas-stg-voice-prefetch-20261001`, in `atlas-stg-isolated-20260831/us-central1-a`, reuses the previously validated credential-free golden image and existing restricted staging worker identity/private network. One L4, g2-standard-16, no external IP, no IAM/firewall changes, no sidecar registration or production routes. Compute stops it after at most one hour; the guest also schedules shutdown at 55 minutes and powers off immediately after completion/error. The model container cannot initiate network/metadata connections and exposes its service only on host loopback. The runner test shares that isolated container network. Delete the owned VM and auto-delete boot disk after collecting results.

The unchanged production model digest and unchanged runner/dispatcher image run four counterbalanced cases: current settings, the complete candidate flag combination, candidate again, then current settings. Each uses four completed warmups before measurement and the same public face. Synthetic identifiable 40-ms PCM frames permit checking missing/duplicated/reordered audio. The real runner consumes the real model's stream; a local consumer is paced at 25 FPS. Measure first returned speech, voiced frame preservation, intra-speech gaps and per-request duration. No browser/LiveKit/provider is included, so even a pass still requires a transport rehearsal. The test does not promote any configuration.

Startup SHA-256: `90e02b713e0aced135f3e8153510f2a61e85bbe3a1c0ceecae8eb4bd013c95ac`. Client and startup are prepared in `/private/tmp/atlas-prefetch-model-20261001`. Preflight found no running staging GPU. The native request ID and returned operation will be saved before further observation; a timeout does not authorize recreating the VM.

## Real-GPU allocation unavailable; paced simulation rejects simple rollout

Both native Compute inserts ended with `ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS`: first us-central1-a, then one bounded alternate attempt in us-central1-b. Follow-up instance/disk lists for the exact owned probe name were empty. No real-model test ran. The pending plan above is not an acceptance result.

A CPU-only dry run caught that the first prepared full-loop harness did not await asynchronous `push_audio`; its zero-output results are invalid and excluded. The corrected harness awaits submission. Corrected startup SHA-256 is `94ca815ff4f068390c4120bf68295e584eb05139d6d7fe97c5eca5f4dc7dd706`, not the initial plan's hash. No version of this new harness ran on a GPU.

Corrected CPU build `200eb42c-47f6-4621-bdf5-682c8da91e72` completed successfully. The real runner's input queue, inference loop, decoder and output generator were used with a synthetic binary response and a local consumer paced at 25 FPS. The response generator sleeps 400 ms initially and 29 ms between frames; decoding/queue work adds to those intervals. Observed synthetic request durations were approximately 1.6 seconds, so this is **not** a calibrated reproduction of the real model's approximately 1.3-second full-stream duration. It is useful as a continuity stress case and harness validation, not a production latency estimate.

| Counterbalanced case | First returned speech after input onset | Largest intra-speech gap | All 100 identifiable input frames preserved in order |
| --- | --- | --- | --- |
| Current settings, first | 1671.2 ms | 420.3 ms | Yes |
| Candidate, first | 716.0 ms | 999.0 ms | Yes |
| Candidate, second | 719.8 ms | 996.4 ms | Yes |
| Current settings, second | 1661.7 ms | 373.3 ms | Yes |

The candidate moves speech forward but leaves a roughly one-second gap after the initial eight-frame portion while waiting for the next 32-frame batch. This rejects promoting the simple flag combination on the strength of the earlier 280-ms submission result. It does not establish that current live production has these gap durations. The approximately 1.3-second whole-conversation target remains unproven.

Reproduction: `runner-paced-model-probe.py` is the corrected full-loop harness. The CPU wrapper `runner-paced-simulation-wrapper.py` loads it from `/probe/runner_probe.py`, substitutes only the model HTTP client, and uses the same pinned image and `/probe/face.jpg` as the earlier CPU jobs. Results are in `runner-paced-simulation.json`; allocation receipts are in `prefetch-model-capacity.json`.

Next direction: investigate whether provider audio can reach the existing avatar stream ahead of realtime playback, avoiding the demo's paced media bridge without shrinking model batches. This is a hypothesis, not an implemented or measured improvement. LiveKit documents that its avatar DataStream output accepts frames faster than realtime, but the receiver defaults to the first agent participant, so a browser cannot simply replace that sender. Any experiment must preserve authenticated session routing and test the appropriate agent path rather than impersonate an agent or change production GPU settings. [LiveKit DataStreamAudioOutput](https://docs.livekit.io/reference/agents-js/classes/agents.voice.DataStreamAudioOutput.html), [LiveKit Python avatar interfaces](https://docs.livekit.io/reference/python/livekit/agents/voice/avatar/index.html).

At 05:06:34 UTC, demo, dashboard and API health returned HTTP 200; all ten main-security workers were ready with unchanged avatar/dispatcher/sidecar hashes. Dashboard configuration and the public demo alias were unchanged. No staging VM or disk remained from either failed allocation. All CPU jobs for this investigation are terminal; the goal remains active.


## Provider-ahead delivery: real timing, isolated runner replay

Three public synthetic **typed** requests to the existing OpenAI model returned their first PCM chunk in 608–757 ms. Each response provided at least 1.28 seconds of audio within 113–147 ms after that first chunk. All 3.6–4.6 seconds of audio arrived within 432–612 ms after the first chunk. This establishes faster-than-playback availability for this small provider-only sample; it does not measure microphone/VAD, Atlas, video, network distribution or whole-conversation latency. No production prompt or customer audio was sent by this standalone probe. Only timing metadata was retained; connections closed after each trial. See `provider-ahead-timing.json` and `provider-ahead-probe.py` (requires `OPENAI_API_KEY` in its environment).

CPU build `f6d26102-b6fd-4c88-868d-bca067ea3bf9` completed SUCCESS. It replayed the third response's arrival schedule using unique synthetic PCM identifiers, the pinned exact runner, unchanged production flags, the previous synthetic model response, and a 25-FPS consumer. The same four-second identifiable utterance was preceded by 800 ms of silence and followed by two seconds of trailing silence. Four cases compared paced input with early delivery in 40-ms and 100-ms chunks. This does not use the provider's actual audio.

| Input delivery | First returned speech after input onset | Largest intra-speech gap | All 100 speech frames preserved in order | Maximum runner input queue |
| --- | --- | --- | --- | --- |
| Paced 40-ms frames, before | 1671.0 ms | 372.9 ms | Yes | 1280 ms |
| Provider-ahead 40-ms frames | 1283.6 ms | 374.4 ms | Yes | 1280 ms |
| Provider-ahead 100-ms frames | 1274.0 ms | 500.6 ms | Yes | 1200 ms |
| Paced 40-ms frames, after | 1659.9 ms | 377.8 ms | Yes | 1280 ms |

Ahead delivery advanced startup by approximately 380–397 ms in this fixture but did not remove playback gaps. No voiced frame was dropped, duplicated or reordered. Awaited submission blocked for up to 1.61 seconds, and the sender fell approximately 2.89 seconds behind provider arrival. The bounded runner queue therefore does **not** prove bounded buffering in the browser, agent, or LiveKit receiver. The 100-ms case had a larger final gap. Neither accelerated delivery nor a production rollout is accepted on this evidence.

The model is simulated, not calibrated to production throughput: its observed request duration includes synthetic sleeps and decoder/queue overhead. Reported gaps are this stress test's gaps, not a claim that customers experience those values. Leading silence and batch phase also influence startup, so the small counterbalanced fixture is not a percentile estimate. Reproduce with `runner-ahead-simulation-probe.py` mounted as `/probe/runner_probe.py`, `runner-ahead-simulation-wrapper.py` as `/probe/probe.py`, and `provider-ahead-timing.json` as `/probe/provider-schedule.json`, using the same pinned CPU-only container configuration above. Full numerical output is in `runner-ahead-simulation.json`.

Any next transport prototype needs authenticated driver-to-agent forwarding (not direct impersonation of the GPU receiver's expected agent), bounded buffering across the whole path, ordered segment completion, interruption/flush semantics, and prevention of simultaneous media-track and PCM forwarding. A production CPU deployment image read found multiple agent deployments; the relevant live session routing/source baseline must be verified before an implementation. No agent, browser transport, model, flag, deployment, or account change was made by these experiments.

At 05:18:27 UTC, public demo, dashboard, and API health returned 200. All ten main-security GPU workers were ready on the original three image hashes; dashboard configuration and public demo alias were unchanged (`ahead-production-health.json`). The target remains open, and the user's resolved visual concern is excluded from further changes.


### CPU agent source check and prototype boundary

Read-only AST metadata checks on one ready replica each of `agent-worker` and `agent-worker-launch-25` found `_run_passthrough` and no `register_byte_stream_handler` calls. This is evidence about those two files, not proof that no imported module can register a handler. Their source hashes and image pins are recorded in `ahead-agent-metadata.json`.

The launch-25 source hash `de7a5c2528fc42c2295d8f9701cda1962cfa36e60c87f2bec5268b06f6fb633f` exactly matches local Git revision `b677d6f3c5c05658752f8f65c213314a0ed165f7`, path `apps/realtime-agent/agent_worker.py`. The default agent's source hash `e3ef40adac282b7331d73c42b4b8c49dcd272f7d3780e488ac8bb75144137175` did not match the nine available Git file revisions or nine isolated local worktree copies checked. The dirty root source matches neither and must not be used as a deployment baseline. No production source was exported and no files in the shared root checkout were changed.

The matched local source forwards subscribed media tracks to the GPU via `DataStreamAudioOutput`. It deliberately avoids flushing on ordinary track end because a playback-end marker can make the GPU participant leave. A PCM prototype must not treat every provider response as a room-ending stream. It must preserve the legitimate agent sender, use an explicit owned driver identity, reject viewers and concurrent forwarding sources, support cancellation without stale queued audio, and limit buffered audio across sender/receiver boundaries. Begin as an isolated opt-in transport with the current media path as the unchanged default. Do not select or replace a production agent pool until owned-session routing and that pool's complete source baseline are established.


### Speech-only onset comparison

CPU build `0dcd20b9-d9ed-4b51-aa9b-e89048a82096` completed SUCCESS at 05:25:58 UTC. The same unchanged runner and synthetic model were tested without the earlier 800-ms leading silence; input starts immediately after the four completed warmups and render-queue drain. Four counterbalanced cases produced:

| Input | First returned speech | Largest intra-speech gap | Speech preservation |
| --- | --- | --- | --- |
| Paced 40 ms, before | 1661.3 ms | 372.6 ms | All 100 frames, ordered |
| Ahead 100 ms, first | 545.0 ms | 368.4 ms | All 100 frames, ordered |
| Ahead 100 ms, second | 531.7 ms | 452.9 ms | All 100 frames, ordered |
| Paced 40 ms, after | 1657.6 ms | 372.5 ms | All 100 frames, ordered |

This is approximately 1.11–1.13 seconds earlier onset in a speech-only fixture. Input queues remained at or below 1.28 seconds; no speech samples were missing, duplicated or reordered. Faster delivery still blocked at the runner and did not eliminate synthetic playback gaps. The browser/provider/VAD/network and real model are excluded. In particular, this starts speech immediately after warmup: it does not demonstrate behavior when a long-lived avatar is already producing idle animation between conversational turns. That idle-to-speech case, bounded transport buffering, interruption and a real-model rehearsal are required before any live experiment. Do not add the provider-only numbers to this simulated result and label the sum measured end-to-end latency.

Reproduction: substitute `runner-ahead-onset-probe.py` for `/probe/runner_probe.py` in the same isolated CPU configuration. Numerical results: `runner-ahead-onset.json`. The wrapper, immutable image and public face remain identical. These results justify investigating an isolated speech-only PCM transport; they do not approve promotion or a model/configuration replacement.

Final 05:26:43 UTC verification again found demo, dashboard and API health HTTP 200, ten ready main-security GPU workers on the original image hashes, and unchanged dashboard snapshot/public demo alias. Both new CPU builds are terminal SUCCESS. No staging GPU was allocated, no user session was started, and no production configuration, model or customer data was changed in these experiments.
