# Provider residuals and rejected post-drain experiment — October 1

**No fix accepted or deployed.** The public demo remains deployment `dpl_4Gn3kBtiXyzeTusyp8y1b5imU3Ff`. A newly added quiet-buffered-signal acceptance test rejected the local worklet candidate before it reached a hosted preview. Application source was restored; the rejected code exists only here as evidence.

## Observed browser path

An owned synthetic conversation used the existing protected diagnostic deployment `dpl_C3hjBnppvMsBs3CvcYHpjbRozy98`. `provider-probe.js` observes the decoded OpenAI audio track before Atlas publication, retaining numeric RMS, mean and first-difference measurements at 20 ms intervals. It does not retain speech PCM, transcripts, credentials or customer data. Its additional AudioContext can perturb scheduling; this is not a latency benchmark.

Five provider buffer-stop events were captured; four have a complete 1.5-second measurement window, and the fifth is truncated. In the complete windows, observed peak RMS ranged from 0.000121 to 0.000456. In two windows the bracketed inbound-audio counters showed neither packet loss nor concealed samples. The low mean/RMS ratios show the measured residuals are not predominantly DC offset. The nonzero residual is already present in the browser's decoded provider track; this does not distinguish provider synthesis from provider-side encoding or browser decoding. In particular, it does not establish exact PCM delivered to the model.

RTC counter brackets run from the last stats observation before the stop to the first observation after 1.5 seconds, so their durations exceed the envelope windows. These data rule out a packet-loss-only explanation for all sampled residuals. They do not prove packet recovery never contributes.

Twelve timestamped screenshots cover four returned-audio quiet transitions. In this run the mouth appears closed at all sampled times, starting 403–476 ms after observer quiet. See `contact.jpg` and `review.json`. Thus a residual above the visual gate in the upstream observation is not, by itself, proof of a visible failure on that turn. Sparse frames and RMS thresholds are not phoneme-level playback verification. Earlier controlled queue/resampler tests and intermittent browser reproductions remain relevant.

The frame trace also contains four presentation gaps of 166.7–250 ms. Three brackets include packet-loss/NACK increases; one of these occurs while returned audio was last observed active. The fourth has no corresponding loss increase and its audio state is unknown. This supports packet recovery as a contributor to some glitches, not a complete causal explanation. Stats brackets span roughly 1–2 seconds. All observed candidate pairs used UDP. See `video-gaps.json`; no receiver-buffer or latency setting was changed.

The owned session was deleted with HTTP 200 and the isolated browser closed. This turn created no staging GPU, model deployment, production route change or customer-key/account mutation.

## Candidate rejected

The local candidate inserted a no-buffer worklet before Atlas publication. It copied active audio unchanged, then allowed attenuation below RMS 0.001 after 80 ms of quiet, only following a matching provider `output_audio_buffer.stopped`. Its effect expired after one second and reset on the next response. It was disabled by default behind a build flag.

Six initial tests passed, including unarmed quiet audio, active whispers and audible buffered speech. The seventh test supplies a quiet signal still buffered after the provider stop. It fails: the candidate changes samples after 80 ms and subsequently zeros them. The fixture is a low-amplitude synthetic signal, **not** a recording proving a user lost a word. It establishes that this implementation cannot satisfy the required buffered-quiet-speech preservation contract. Low amplitude alone cannot distinguish remaining quiet articulation from unwanted residual audio.

OpenAI documents the stop event as the **server** output buffer draining, with no more audio forthcoming; it does not guarantee that the browser's receive/playout buffer has drained. See [the server event reference](https://developers.openai.com/api/reference/resources/realtime/server-events#output_audio_buffer.stopped). A provider event plus a quiet threshold is therefore insufficient for this fix.

Reproduce the rejection with:

```sh
node --test docs/demo-quality/post-drain-tail/rejected-acceptance.mjs
```

Expected: six pass, one fails, exit 1. This is an archived negative experiment, not the application's test suite. `rejected-worklet.js` and `rejected-integration.patch` are not imported, served or enabled by the app. `rejected-acceptance.txt` retains the observed result.

## Production guard

At 18:01:58 UTC, all ten main workers were ready with original model, runner and sidecar image digests; demo, dashboard and API health each returned HTTP 200. Demo alias and dashboard snapshot were unchanged. See `release-health.json`. The read-only guard at 18:06:56 UTC additionally verified all 53 explicit visual settings on every worker and the replacement template; see `human-model-guard.json`. Health responses and image identity do not independently prove every customer generation path.

## Remaining work

Obtain a trustworthy source-speech/end boundary and actual normalized model-input PCM from an owned full-transport session, retaining enough bounded private input for replay. The existing controlled queue test validates the residual mechanism but omitted 14 trailing frame-equivalents per trial and discarded PCM when the VM was removed; it cannot stand in for a full drain or conversational replay. Any remedy must preserve quiet endings, immediate following turns and paired audio timing, then pass repeated visual checks. Do not retry arbitrary higher thresholds, freeze the avatar or infer model identity from a mutable image tag.
