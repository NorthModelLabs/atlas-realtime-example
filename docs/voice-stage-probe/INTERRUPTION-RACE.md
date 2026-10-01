# Typed voice interruption race

The unchanged instrumented minimal-reasoning preview reproduced an overlap: two UI submissions 31 ms apart both preceded the first `response.created` acknowledgement by about 88 ms. Only the old counting response was observed; the UI displayed “Voice request failed” and did not obey the replacement greeting request. The microphone was muted for this reproducible pair. A preceding attempt was contaminated by Chrome synthetic microphone noise and is not used as the clean timing evidence. Its owned session was cleaned up with HTTP 200.

The previous client only tracked a response after `response.created`, so it sent both `response.create` requests immediately. Its completion bookkeeping was also tied to the current caption ID, which is reset when new text is submitted.

The candidate tracks the creation request before acknowledgement. Subsequent typed messages remain in conversation order, but wait for cancellation/completion before requesting one replacement response. Late captions from a superseded response cannot overwrite the new input. A rejected creation releases the pending state for retry; unrelated errors or stale completions do not release an active response. Diagnostics expose only allowlisted provider error codes in an instrumented preview.

Eleven access, caption and response-sequencing tests pass, as does TypeScript. Browser acceptance and publication are pending. This fix does not clear audio already queued inside Atlas and does not establish sub-1.3-second latency or fix post-speech mouth motion. No production worker/model image or configuration was changed.

Reference: [OpenAI Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events) documents that only one response can write to the default conversation, cancellation emits `response.done`, and cancellation should precede output-audio clearing.

## Protected preview acceptance

Final preview `dpl_7fNMrbvvQq4fFpMUYTn8MKZmqBtw` built successfully. Three ordinary UI replacement pairs ended in the requested “hello,” with cancellation followed by one new response, no provider error events, no JavaScript errors and app API HTTP 200. These browser pairs arrived after the initial acknowledgement (about 0.5–0.8 seconds apart); the narrower before-acknowledgement interval is covered by the deterministic regression test, not claimed as reproduced in this candidate browser run. A forced-fill attempt did not submit a second message and is excluded.

After 43 seconds with no returned speech, a new counting answer was interrupted 70 ms after its first returned audio. The provider reported cancellation 184 ms after the interrupt input and a new response 305 ms after it. The replacement “hello” appeared correctly. Old returned audio still appeared after provider cancellation; returned speech was not instantly flushed. This remains a limitation, not an accepted fix for downstream interruption delay. The owned session was deleted with HTTP 200. No GPU configuration changed.

Final review also retained the caption-ID guard for failure alerts, so a failed superseded response cannot display an error over a newer turn. This one-line correction is commit `d618f07`; TypeScript passed again. The production candidate is `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`, built with diagnostics disabled. Its predecessor production candidate was never assigned to the public hostname.

## Publication and post-release verification

On October 1 at 04:28:40 UTC, only `demo.northmodellabs.com` moved from `dpl_CpzxuFhZvF9M1Vs92emkR6Qd7DSe` (rollback) to `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`, runtime `d618f07a59c7e9a4e6dba575f3ec1297043b96cb`. Final unaliased acceptance recognized the spoken question, answered correctly, showed returned Speaking followed by Listening, and had zero JavaScript errors/diagnostic messages. Its owned session cleanup returned 200.

Public URL acceptance then submitted counting followed by “Stop counting. Say only hello.” The replacement “Hello.” appeared without an error; config/session/share/voice returned 200, no JavaScript errors or diagnostic messages appeared, and that owned session cleanup returned 200. This establishes functional response sequencing, not the duration of all downstream audio still in flight.

The 04:29:37 UTC read verified the published alias, all ten main-security workers ready with the same original avatar/dispatcher/sidecar image hashes, unchanged dashboard configuration, and HTTP 200 from the demo, dashboard and public API health endpoint. No model/worker image, worker configuration, customer row or existing key was changed by the release.

The full goal remains open: roughly 1.3-second whole-conversation response time is not demonstrated, queued Atlas audio persists after provider cancellation, and sporadic cutoffs/post-speech mouth motion are not claimed fixed.
