# Demo voice latency — September 30, 2026

Baseline: public demo, deployment dpl_G1ETQfSzE72KJjiCojRGsmh8We11. Synthetic microphone phrase: “Please say hello from Atlas.” Browser and provider requests originate on the same local machine. Short samples, not a load test or p95 estimate.

## Measurements

- Current demo: last outgoing microphone chunk with amplitude >500 to transcript commit: 0.940–1.231 s (three turns). Chat request: 0.676–1.406 s. Complete ElevenLabs TTS response: 0.301–0.331 s.
- Two baseline turns measured at the returned browser audio element: approximately 4.949 and 5.005 s from last detected outgoing speech to first returned audible samples (RMS >0.005). The browser audio observation started after the first turn. TTS completion to returned audio: 2.302 and 2.326 s. Microphone chunking and 20ms audio polling make these approximate.
- Direct ElevenLabs turbo v2.5, fixed 16-word sentence: complete file 0.257–0.385 s, median 0.282 s.
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
