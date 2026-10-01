# Pending exact input capture

Status: local recorder tests and three controlled actual-image trials pass. **The mouth-tail fix remains unaccepted.** Google Cloud access was restored on October 1. The read-only guard at 17:11:16 UTC verified all ten production workers and their preserved images/visual settings. Public demo, dashboard and API health returned HTTP 200 at 17:19:51 UTC. The initial Vercel metadata check returned 403, then the existing CLI refreshed its session successfully. The 17:39:14 UTC release check confirmed the original demo deployment, unchanged dashboard settings, ten ready production workers on the original image digests, and three public endpoints returning HTTP 200. No production instrumentation or model changes.

The prior browser observations are before encoding or after return playback. They do not measure the normalized PCM sent to the renderer. `scripts/diagnostics/renderer_input_capture.py` is a test-harness utility for a single owned generator instance in isolated staging. It records the exact `_run_inference_streaming` input bytes and the separate paired audio frames without substituting either object, then delegates the original call. This point is after runner normalization and before model-side WAV decoding/preprocessing. It does not establish what later preprocessing does to those bytes.

The module does nothing on import. Installation requires the runner source SHA-256 to match the exact preserved runner image's `/workspace/avatar_runner.py` (`55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec`). Current root-checkout and older Git snapshot files differ and must not be substituted. There is no integration into production or the demo application.

Capture is bounded to 128 requests and 8 MiB of PCM by default. It creates a new private directory (0700), exclusively creates files (0600), and never prints PCM or transcripts. Budget exhaustion or a recording failure disables further recording and forwards the original call; the final manifest makes incomplete evidence explicit. Source mismatch rejects installation before writing files or hooking the instance. The hook is removed by `close()`. Filesystem I/O can perturb timing, so this recorder is not valid for a response-latency benchmark.

## Staging capture plan

1. Run the existing read-only ten-worker image/configuration guard. Retain the same production hashes and check public availability.
2. Use one bounded isolated staging worker with the same model/runner digest pins and baseline eye/mouth settings. No production process attachment, routing change, customer room or key is part of this test.
3. Create an owned synthetic conversation on that isolated path. Install the recorder only on its generator instance before sending the synthetic speech. Capture the rendered frames and the actual returned audio with their pairing/timestamps. Keep the source and returned tracks intact.
4. Always close the recorder in `finally`, and clean up the owned session, VM and disk. Verify the manifest reports no recording error or truncation before treating evidence as complete.
5. Replay the captured normalized input against the same exact model. Compare the original tail with a clean-zero-tail control **after a reviewed speech boundary**, retaining all speech samples, duration, frame alignment and paired playback audio. This is an isolated causal comparison, not authorization to suppress live audio.
6. Accept a fix only after repeated conversational visual checks and quiet-speech regressions. Model/input hash receipts alone do not prove a settled mouth, correct eyes or production health.

## Local contract checks

`python3 -B tests/diagnostics/test_renderer_input_capture.py` verifies byte identity, argument/result identity, distinct normalized/paired recordings, private file permissions, restoration of the original instance method, forwarding after budget exhaustion, propagation of the model's original exception despite recorder failure, and rejection of an unexpected runner source. A synthetic test-double hash is used only in the unit tests; those tests do not claim runtime compatibility with the preserved image. Actual-image binding was subsequently validated in the three controlled queued trials below; full conversational transport capture remains pending.

## Resumed runtime check — October 1

The first three `g2-standard-12` requests were rejected for capacity in us-central1-c, us-central1-a and us-central1-b. Each failed request was followed by an authoritative check confirming that neither VM nor boot disk existed. The alternate `g2-standard-16` shape is confirmed to contain exactly one L4, with 64 GiB RAM. Its bounded request succeeded in us-central1-c: instance `4355492381883312484`. The 30-minute cloud stop deadline and guest shutdown timer were retained. The guest terminated after its test; the exact owned instance and its boot disk were verified deleted at 17:42:37 UTC.

`queued-probe.py` extends the earlier direct inference tests by passing the public synthetic speech fixture through the preserved runner's `push_audio`, queue, actual resampler, normalization and inference loop. Three trials use a clean tail, a six-unit PCM residual tail and a repeated clean tail. The recorder is installed only on the owned staging generator; input hashes and framewise RMS are compared with paired output audio. Model parameters and image digests stay at baseline.

This is **not** a capture of an actual OpenAI → browser → LiveKit decoded conversation. It can validate the recorder against the real image and locate changes introduced by the runner queue/resampler; it cannot by itself establish the provenance of residual samples seen in a real browser conversation. The planned full transport capture remains outstanding. No remedy is accepted or promoted by this test.

## Results

All three trials completed against the preserved runner and model. The recorder captured 24 full-length inference calls without a recording error, representing 768 paired output-audio frames. Every recorded normalized input hash matched its corresponding paired-audio hash. Each trial supplied 270 frame-equivalents and retained 256 paired output frames; the remaining 14 trailing frame-equivalents were not accounted for by this harness. Input stopped without an explicit segment-end marker, so this is not a full-input drain acceptance test. All reviewed tail samples are within returned paired frames. The synthetic clean tails produced no output frames above the existing mouth silence threshold (normalized RMS 0.0001, about 3.28 PCM16 units); the six-unit tail produced 50 such frames after resampling, approximately two seconds.

Visual review of 22 hash-verified images shows the first clean trial settled by 400 ms, the residual trial still open at 2000 ms and closed at 3000 ms, and the repeated clean trial closed by its next available 800 ms sample. The residual trial's 800 ms image and repeated clean trial's 400 ms image were lost in serial transfer. One damaged serial JSON record initially stopped the collector; it was subsequently counted and rejected. No missing frame was reconstructed or treated as verified. See `review.json` and the three contact sheets.

This strengthens the causal evidence that very low residual audio can hold the model's existing mouth gate open through the actual runner queue/resampler. It does not prove that the real demo's residual samples originate in OpenAI, Web Audio, Opus, LiveKit or another stage. Raw PCM was recorded only inside the ephemeral private staging container; retained receipts contain hashes and envelopes. A faithful full-transport capture with bounded private PCM export remains needed for exact replay of a real conversational tail.

No production remedy was promoted. Previous higher-threshold candidates remain rejected because of quiet-speech regressions. The next comparison must preserve quiet articulation and existing response/audio timing. The goal remains active.

Production safeguards: the staging visual settings match all 53 baseline fields; the original human model hash remains pinned. The public health watcher recorded only HTTP 200 responses through 17:42:48 UTC. A bounded production log sample contained no generation timing events, so no latency or stutter conclusion is drawn from it. No owned staging VM or disk remains.
