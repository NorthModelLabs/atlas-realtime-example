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

## Verified release and visual follow-up

Published demo-only runtime `7a6aae2451273c898ac51419c682113d73cccbc4`, deployment `dpl_BmQfZxuWAiUhSk4DNm5Vt1xpKGxp` (`demo-atlas-57wdbjxk5-north-model-labs.vercel.app`). The public alias and exact favicon bytes were verified after promotion; dashboard aliases/settings matched the pre-promotion snapshot. The previous deployment above remains the rollback target.

Protected preview: spoken “What is two plus two? Please answer in one short sentence.” produced the correct user caption and “Two plus two equals four.” An English follow-up asking to multiply the result by three produced twelve. Interrupting a longer story with “Stop the story. Say only: Ready for your next question.” switched to that response without a browser error. The exact production candidate separately passed spoken captions and a typed contextual follow-up with audible returned audio, 512×512 video, and zero JavaScript errors. The test initially expected numeric `12`; this assertion was corrected to also accept the observed spelled-out `twelve`.

Timestamped screenshots and returned audio observations in the spoken preview showed mouth closed by approximately 0.9 seconds after the last audio above RMS 0.005, and closed at approximately 2.6, 5.4 and 6.5 seconds after. This short run did not reproduce persistent post-speech mouth motion. One reviewed frame was 0.29 seconds *before* audio ended and correctly had an open mouth. Do not mistake response text completion for returned speech completion.

The screenshot-heavy observation reported 24 dropped frames in 27 seconds; a separate 15-second exact-candidate observation with no screenshots delivered 375 frames with three dropped frames. Capture overhead can affect these measurements. The correlated owned GPU session had median 25.765 FPS (minimum 25.217), no error lines, and median render queue nine. This differs from the slower aggregate sample and does not establish a universal GPU bottleneck or prove the user's intermittent cut-off is fixed.

Local origin/ownership boundary tests passed using synthetic credentials and zero real provider calls. Six capability/caption tests, TypeScript, focused lint and candidate production build passed. Test sessions were deleted individually; no user session was stopped.

Still open: reproduce intermittent cut-off and longer post-speech mouth motion under representative real microphone/network conditions; distinguish unintended VAD interruption, returned playback, GPU pacing and natural idle animation. No GPU tuning, model replacement, account migration, existing-key change, or UI freeze workaround was deployed.

Public acceptance after promotion also passed: a fresh owned session displayed the spoken math question and correct English answer. All ten main-security pods remained ready on the original digests. Public and preview test sessions were cleaned up individually. Runtime source is unchanged by these final documentation commits.
