# PCM forwarding prototype — not deployed

This directory is not imported by the demo or production agents. It is a first
implementation for isolated transport acceptance, not a supported API or a
replacement deployment. Production GPU/model images and media forwarding remain
unchanged.

`sender.mjs` splits 24-kHz mono PCM16 into at most 200-ms chunks, with four RPCs in
flight and a 30-second per-turn input limit. `bridge.py` authenticates every
message against the server-assigned driver, orders that four-chunk window,
rejects conflicting retries, and acknowledges only after forwarding. A matching
completed retry does not replay audio. Missing chunks time out and cancel the
turn rather than skipping words. The agent retains at most 38,400 bytes of
pending PCM plus its currently encoded RPC input and bounded acknowledgement
metadata. This is not a bound on LiveKit's or the GPU receiver's internal queues.

The sender's queue, active requests and accepted audio together are capped at
30 seconds (1,440,000 PCM bytes, excluding temporary encoding/caller copies).
Forwarding is paced to at most 1.28 seconds ahead of elapsed time beginning with
the first audio chunk. A turn that has ended is sealed, not declared heard or
played; cancellation must finish before opening the next generation. A failed
sink clear makes the connection unusable until reconnected.

The current tail experiment pads to a 32-frame boundary without closing the
avatar stream. **This is not accepted as sufficient for production:** the exact
runner may drop incoming silence under backpressure, and its 24→16-kHz
resampling and receiver frame boundaries require an integrated tail test. A
successful local `end` only proves bytes were passed to the test sink.

`livekit_ingress.py` registers `atlas.pcm.v1` only when explicitly enabled for a
PCM-only session. Its caller identity comes from LiveKit, never the JSON payload.
The host must enforce exclusive audio mode and pass a sink with a verified
receiver-side cancellation barrier. It is deliberately not wired into the
existing agent. The ordinary SDK `clear_buffer()` schedules asynchronous work;
neither that call returning nor its RPC response alone proves the GPU has
discarded all old output. Installing an adapter with a no-op or fire-and-forget
clear function would invalidate the cancellation tests.

Run locally, without credentials or network:

```sh
cd experiments/pcm-bridge
python3 -m unittest -v test_bridge.py
node --test sender.test.mjs
```

The Python suite tests authorization, reordering, retries, bounded admission,
cancellation races, missing chunks, sink failure, tail padding, pacing, duration
limits and malformed input. The Node suite tests sender backpressure/failure and
launches the real Python ingress as a local subprocess to verify byte-for-byte
speech preservation plus padding across arbitrary provider chunk boundaries.
`protocol_fixture.py` is test-only and never connects to LiveKit or OpenAI.

Remaining acceptance: SDK registration/wire compatibility; authenticated owned
staging session routing; cancellation through the actual SDK/runner; resampling,
tail and stalled-consumer behavior; real-model continuity; microphone/VAD and
warm multi-turn browser measurements. Keep the existing media default until
those pass. Existing customer accounts and keys are outside this prototype.

References: [LiveKit RPC](https://docs.livekit.io/transport/data/rpc/) supplies
authenticated caller metadata and limits each payload to 15 KiB. The
[avatar interfaces](https://docs.livekit.io/reference/python/livekit/agents/voice/avatar/index.html)
describe streamed audio and asynchronous clearing. OpenAI's
[Realtime WebSocket guide](https://developers.openai.com/api/docs/guides/voice-websockets?api=realtime)
supports short-lived browser credentials; provider connection/microphone
integration is not implemented here. Preserve `gpt-realtime-2.1` and the existing
prompt when that integration is tested.
