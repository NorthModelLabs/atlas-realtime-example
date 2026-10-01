# Pending exact input capture

Status: local recorder tests pass; **not yet run against a real runner or model**. Cloud reauthentication is still required. No production instrumentation or new staging VM/session was created for this preparation.

The prior browser observations are before encoding or after return playback. They do not measure the normalized PCM sent to the renderer. `scripts/diagnostics/renderer_input_capture.py` is a test-harness utility for a single owned generator instance in isolated staging. It records the exact `_run_inference_streaming` input bytes and the separate paired audio frames without substituting either object, then delegates the original call. This point is after runner normalization and before model-side WAV decoding/preprocessing. It does not establish what later preprocessing does to those bytes.

The module does nothing on import. Installation requires the runner source SHA-256 to match the exact preserved runner image's `/workspace/avatar_runner.py` (`55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec`). Current root-checkout and older Git snapshot files differ and must not be substituted. There is no integration into production or the demo application.

Capture is bounded to 128 requests and 8 MiB of PCM by default. It creates a new private directory (0700), exclusively creates files (0600), and never prints PCM or transcripts. Budget exhaustion or a recording failure disables further recording and forwards the original call; the final manifest makes incomplete evidence explicit. Source mismatch rejects installation before writing files or hooking the instance. The hook is removed by `close()`. Filesystem I/O can perturb timing, so this recorder is not valid for a response-latency benchmark.

## Staging use, after authentication is restored

1. Run the existing read-only ten-worker image/configuration guard. Retain the same production hashes and check public availability.
2. Use one bounded isolated staging worker with the same model/runner digest pins and baseline eye/mouth settings. No production process attachment, routing change, customer room or key is part of this test.
3. Create an owned synthetic conversation on that isolated path. Install the recorder only on its generator instance before sending the synthetic speech. Capture the rendered frames and the actual returned audio with their pairing/timestamps. Keep the source and returned tracks intact.
4. Always close the recorder in `finally`, and clean up the owned session, VM and disk. Verify the manifest reports no recording error or truncation before treating evidence as complete.
5. Replay the captured normalized input against the same exact model. Compare the original tail with a clean-zero-tail control **after a reviewed speech boundary**, retaining all speech samples, duration, frame alignment and paired playback audio. This is an isolated causal comparison, not authorization to suppress live audio.
6. Accept a fix only after repeated conversational visual checks and quiet-speech regressions. Model/input hash receipts alone do not prove a settled mouth, correct eyes or production health.

## Local contract checks

`python3 -B tests/diagnostics/test_renderer_input_capture.py` verifies byte identity, argument/result identity, distinct normalized/paired recordings, private file permissions, restoration of the original instance method, forwarding after budget exhaustion, propagation of the model's original exception despite recorder failure, and rejection of an unexpected runner source. A synthetic test-double hash is used only in the unit tests; those tests do not claim runtime compatibility with the preserved image. Actual-image execution remains pending.
