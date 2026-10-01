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
