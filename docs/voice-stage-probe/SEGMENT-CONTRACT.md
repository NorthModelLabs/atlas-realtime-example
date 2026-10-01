# Exact-runner segment contract — 2026-10-01

Build `36a63ed4-0130-4ff1-98d6-3355e5160bc2` completed successfully in the
isolated staging project. This CPU test uses the unchanged dispatcher image
`830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee`,
asserts runner source SHA-256
`55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec`,
and imports its installed LiveKit 1.1.5 / livekit-agents 1.5.2. Model output is
simulated. The container has no network and no production credentials or GPU.

Three successive utterances of 10, 50 and 100 audio frames (40 ms each) preserved
every sample in order, each emitted one segment-end marker, and kept the iterator
alive. An interrupted fourth utterance returned two old frames before clearing;
all ten replacement frames then arrived, with no old audio after the replacement.
This verifies the generator contract under the tested schedule, not a distributed
cancellation barrier or actual model latency.

The prototype now requires an explicit asynchronous sink `end()` operation.
It no longer appends up to 1.28 seconds of silence to flush a partial batch:
incoming silence can be dropped under backpressure. End acknowledgement means
input sealed, not playback finished. Tests cover an end failure and cancellation
while end is pending. All 16 Python and 3 Node tests pass.

Still required before integration: actual data-stream end behavior through
AvatarRunner, receiver resampling, cancellation acknowledgement after old output
is discarded, stall handling, real-model continuity, and warm browser conversation
measurements. The existing agent's historical comment about stream closure is not
overruled by this generator-only test. No runtime deployment is justified yet.

Evidence: `runner-segment-contract.json` and `runner-segment-contract-probe.py`.

## Wire acceptance

Build `cb9000ef-1cfc-4926-b413-8445f787b0d6` passed the actual SDK RPC adapter
against an isolated LiveKit v1.13.7 server. Three test participants used public
development credentials on a Docker `--internal` network with no published ports.
The viewer was rejected using SDK caller identity; four out-of-order chunks
arrived in order (38,400 bytes). Retried chunks and ends were idempotent; old turn
identifiers were rejected; closing unregistered the handler. Its sink was a byte
collector, so cancellation here does not establish a renderer acknowledgement.

The server image was pinned to
`sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3`.
This test establishes compatibility with that test server, not the unverified
production server version. Source and result are `pcm-wire-probe.py` and
`pcm-wire-result.json`; the build config is `pcm-wire-cloudbuild.json`. To rerun,
assemble a private source directory with the probe renamed `probe.py`, plus
`bridge.py` and `livekit_ingress.py` from the experiment directory. The config
contains no production credentials, volumes or endpoints.

## Production observation

At 2026-10-01 05:53:51 UTC, demo, dashboard and API health endpoints returned
HTTP 200. All ten main workers were ready and matched their preserved model,
dispatcher and sidecar digests. Dashboard configuration and demo deployment
assignment remained unchanged. These checks establish reachability and observed
readiness; they do not replace a completed browser conversation test.

## SDK stream test history

`de3258d2-65bd-4f1a-875c-24a92f613788` preserved all three synthetic utterances
but failed in test cleanup: this pinned SDK's DataStreamAudioOutput has no
`aclose()` method. The corrected harness closes the receiver and disconnects
both rooms. No product code changed for this test-harness mistake.

`b7ea4ce0-e651-4674-8900-97d4a0bc75b1` completed successfully and confirmed
exact 24-kHz samples for 10-ms, 500-ms and 1-second successive utterances. It
logged a pending playback notification during disconnect. A final harness
revision waits for each playback-finished notification before disconnecting;
transport cleanup alone is not treated as proof that the sender saw completion.

Final build `c971528a-d627-4cf4-9744-fee763bd3b17` succeeded. All three streams
preserved exact PCM, the receiver stayed alive, and the sender observed all
playback-finished notifications. Both rooms disconnected and the disposable
server/network were removed by the build cleanup. The SDK still logged an RPC
response racing disconnect after notification receipt; shutdown is not claimed
warning-free. This remaining teardown diagnostic does not show missing speech,
but it must not be hidden or extrapolated into production acceptance.

`pcm-stream-probe.py` and `pcm-stream-result.json` contain the final evidence.
Use the same pinned/private build config with this probe renamed `probe.py`.

Production observation repeated at 06:01:33 UTC with the same three HTTP 200
responses, ten ready main workers, preserved digests and unchanged deployment
assignment. All experiments stayed outside the public runtime.
