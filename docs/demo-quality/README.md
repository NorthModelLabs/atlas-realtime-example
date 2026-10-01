# Demo conversation quality follow-up — September 30, 2026

The user reports very fast live replies, occasional playback gaps, lingering mouth movement after speech, missing user captions, and an unexpected Chinese reply. Earlier ~3.1–3.3 s samples were typed-to-returned-audio measurements from three test turns, not a universal conversation delay. Do not present them as every user's experience.

## Scoped changes

- Handle input transcript deltas and completion by item ID; keep the final user text visible alongside streamed assistant captions in the Apple layout. Late transcripts from previous turns cannot replace current captions.
- Match assistant transcript events to response IDs and clear interrupted/cancelled captions. Preserve the existing audio transport.
- Explicit English default, language changes only on a clear request, concise on-topic responses, and clarification for unclear speech. The original prompt did not constrain language. This is a mitigation, not proof of the cause of the user's Chinese response; the preceding utterance was unavailable.
- Replace the default Vercel favicon with the actual white-interior NML mark from `Desktop/website/public/logo.png`. The parent site's downloaded favicon still contained the Vercel triangle, and its PNG used transparent interiors, so neither matched the requested appearance.

## Runtime investigation

Read-only main-security checks: ten pods ready; identical avatar digest f853fbd1dc92ae7a514e93107e3696e8009f74e929180ac361e2e28e9d52e7e4, dispatcher 830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee, sidecar b69fd39d00c132c6d96cbbc3fd4fdaa8a8bb3640c1260430c33db020b07bd991. No model or GPU configuration changes.

Recent aggregate logs show median batch throughput 24.316 FPS against a 25 FPS stream, median render queue 7 frames, and one audio speech-backpressure event. No error/underrun strings were observed in that bounded sample. These are possible sources of uneven playback, not proof of a specific user's cause. See the sanitized aggregate; no account data or transcripts are included.

A public test recorded successful spoken input and audible output, plus browser dropped frames. The captured MediaRecorder video stopped updating before the observation ended, so that recording alone cannot establish post-speech mouth behavior. Follow-up uses timestamped browser screenshots and returned audio measurements. Do not mask mouth motion by freezing the UI or change model weights based on this sample.

## Validation / rollout

Six focused capability/caption tests pass, including delayed input completion and stale interrupted output. TypeScript and the initial production build pass. Protected preview and final candidate acceptance remain required before promotion. Existing public deployment is the rollback target dpl_iLh3eTfxsdSYdr1NEJdhDCYNMqhw.

Parent-site repository repair is separate: a clean clone now lives at Desktop/nmlabs.ai; the complete original directory with eight uncommitted changes is preserved at Desktop/nmlabs.ai-backup-20260930. No parent-site deployment occurred.
