# Demo voice latency — September 30, 2026

Baseline: public demo, deployment dpl_G1ETQfSzE72KJjiCojRGsmh8We11. Synthetic microphone phrase: “Please say hello from Atlas.” Browser and provider requests originate on the same local machine. Short samples, not a load test or p95 estimate.

## Measurements

- Current demo: last outgoing microphone chunk with amplitude >500 to transcript commit: 0.940–1.231 s (three turns). Chat request: 0.676–1.406 s. Complete ElevenLabs TTS response: 0.301–0.331 s.
- Two baseline turns measured at the returned browser audio element: approximately 4.949 and 5.005 s from last detected outgoing speech to first returned audible samples (RMS >0.005). The browser audio observation started after the first turn. TTS completion to returned audio: 2.302 and 2.326 s. Microphone chunking and 20ms audio polling make these approximate.
- Direct ElevenLabs turbo v2.5, fixed sentence: complete file 0.257–0.385 s, median 0.282 s.
- Direct OpenAI gpt-4o-mini-tts, same sentence, streaming PCM: first 960 bytes 0.547–1.674 s, median 1.666 s. Full audio 1.310–2.732 s. This simple TTS replacement was slower in this small sample. First bytes are not necessarily first non-silent audio.
- OpenAI gpt-realtime-2.1: explicit end-of-turn to first PCM chunk 0.597–0.944 s, median 0.690 s (three sessions). Connection setup excluded and separately recorded.
- OpenAI gpt-realtime: corresponding median 0.610 s (three sessions).
- gpt-realtime-2.1 with automatic 500ms server VAD: end of non-silent input to first returned PCM 1.303–1.506 s, median 1.385 s. This includes turn detection, but excludes Atlas/avatar transport and playback.

Provider outputs vary in wording, duration and voice. Realtime is conversational speech generation; the TTS test uses fixed text. These are complementary measurements, not a controlled model-quality or identical-output ranking. Repeated fixed text could benefit from provider caching; no cache behavior was established.

## Decision

User approved replacing the chained speech pipeline with OpenAI Realtime. Use WebRTC, server-side SDP exchange, session-owner checks, and stream the remote speech track into the existing Atlas audio publication. Do not change GPU images, weights, routing, customer accounts, or existing keys. Test the preview before public promotion. A voice-pipeline improvement alone does not prove the remaining avatar delivery delay is fixed.

## Sources

- https://developers.openai.com/api/docs/guides/voice-webrtc?api=realtime
- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/docs/guides/text-to-speech

Raw sanitized results and benchmark scripts are adjacent. Credentials were read from a private local file, never included here. The owned baseline avatar session was deleted successfully (HTTP 200); all provider WebSockets and the browser were closed. Main-security stayed at ten ready replicas with unchanged pinned images.

## OpenAI Realtime rollout

User approved the swap. Runtime source: `3a1faa4c035c8243389a1071b52a51a8b26c5de2`. Production candidate `dpl_iLh3eTfxsdSYdr1NEJdhDCYNMqhw` was tested under its protected URL before promotion. Public hostname: https://demo.northmodellabs.com. Previous ready deployment retained for rollback: `dpl_G1ETQfSzE72KJjiCojRGsmh8We11` (`demo-atlas-gyfugcry3-north-model-labs.vercel.app`). Rollback is a Vercel promotion of that exact prior deployment in project `demo-atlas` / team `north-model-labs`.

The browser now negotiates OpenAI Realtime WebRTC via its owned `/api/session/{id}/voice` endpoint. Server fixes model `gpt-realtime-2.1`, voice `coral`, automatic VAD silence threshold 500ms, and maximum response tokens 512. The remote voice media stream feeds the existing Atlas audio publication; only the synchronized avatar audio plays locally. Long-lived provider keys never enter the browser. Session ownership, origin, SDP content/size, and active-session checks run before creating the provider call. No GPU/model image, routing, account or existing-key changes.

Validation: production build and TypeScript passed; new hook/route lint passed; ownership unit tests and local HTTP boundary tests passed. Real preview accepted spoken and typed messages, returned audible audio with 512×512 avatar frames, and rejected a second browser's voice request with HTTP 403. Production candidate passed spoken response, mute/unmute, and cleanup with zero browser errors. Legacy `/api/chat`, `/api/tts`, and `/api/scribe-token` were not called by the new flow; they remain for compatibility.

Three preview typed prompts produced first audible returned avatar audio in 3.316, 3.259, and 3.130 seconds. This measures typed submission through OpenAI and Atlas; it excludes microphone capture/VAD. Do not compare this directly against the baseline spoken-to-audio measurement as an identical workload. Provider-only latency improves, but avatar delivery remains a material delay. Interruption cancels OpenAI generation/playback; already-forwarded audio in the avatar pipeline may still drain. Full interruption timing and broad load testing remain outside this acceptance run.

The separate dashboard alias/settings snapshot matched before and after promotion. Test-session records are isolated to our dedicated demo key. Candidate and preview sessions ended; the redundant deletion of the already-ended preview returned 409 and a subsequent authoritative GET confirmed `ended`.
