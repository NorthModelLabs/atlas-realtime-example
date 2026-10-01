# Provider turn-detection comparison — October 1, 2026

Keep the production setting unchanged. Semantic VAD with high eagerness prevented premature turn fragmentation in the paused fixture, but substantially increased response time on the uninterrupted control. It is not accepted as a latency fix.

Both modes used the production demo prompt, `gpt-realtime-2.1`, coral voice, 512 output-token limit, and English input transcription. Audio was paced in 50 ms PCM chunks over WebSocket. Each trial opened and closed its own provider session; no Atlas/customer sessions or production configuration changed. Input and response texts below are synthetic math questions, not customer transcripts. These provider-only measurements exclude WebRTC receive buffers, Atlas rendering and returned playback.

| Input | Mode | Trial 1 first audio | Trial 2 first audio | Premature responses |
| --- | --- | --- | --- | --- |
| Normal uninterrupted question | Current server VAD, 500 ms silence | 1360 ms | 1302 ms | 0 / 0 |
| Normal uninterrupted question | Semantic VAD, high | 3056 ms | 3210 ms | 0 / 0 |
| “What is” + 900 ms pause + remainder | Current server VAD, 500 ms silence | 1226 ms | 1113 ms | 2 / 2, cancelled |
| Same paused question | Semantic VAD, high | 1557 ms | 1337 ms | 0 / 0 |

Latency is measured from the last voiced sample of the **entire** question to the first audio delta of the final response. The paused input joins two generated speech clips; the control is the earlier continuous fixture. Compare modes within each input, not the absolute timings between the two different recordings. Two trials per case are not a p95 or a universal result.

All final responses answered four correctly. Current server VAD segmented the paused input into “What is”, “two plus two?”, and “Please answer in one short sentence”, creating then cancelling responses when speech resumed. This establishes premature turn creation/cancellation in the fixture, not that audible output was necessarily cut: those cancelled responses did not record a first audio delta. The user's intermittent audible gaps remain a separate open acceptance item.

Official documentation describes server VAD as silence-based and semantic VAD as completion-based, with `high` eagerness favoring earlier turns. That describes the mechanism; it does not guarantee semantic VAD will be faster on this workload. [OpenAI VAD documentation](https://developers.openai.com/api/docs/guides/realtime-vad).

The two public synthetic clips were generated with `gpt-4o-mini-tts` PCM using the already-approved demo credential, then reused unchanged across modes. No secret values were logged. Full event timelines and synthetic transcripts are in the adjacent JSON evidence files. No mode, VAD duration, model, prompt or production image was changed as a result of this comparison.
