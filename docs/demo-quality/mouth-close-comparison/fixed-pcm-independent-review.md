# Independent review of validated exact-PCM ABA replay

Reviewed baseline8, candidate2 and repeat8 complete archives under `/private/tmp/atlas-mouth-close-fixed-20261001`, using enlarged consecutive crops104–113 and118–127 plus later samples and all retained full frames52/82/110/130. Comparison artifacts in this directory are derived only from archive-validated images. All three useJPEG quality60 and the same retained input PCM fingerprints.

Normal trial: baseline and repeat remain visibly open atframe120 (+600ms from reference105), narrow across122–124, appear effectively closed around124–125 (+760–800ms), and settled by127 (+880ms). Candidate is still partly open at120 but closed-looking/settled around121 (+640ms). These are visual ranges at64×48 crop resolution, not exact phonetic or speaker timing. The helper's full-weight endpoint127 versus121 is consistent with the visible trend.

Quiet trial: baseline and repeat narrow across107–109 and look effectively closed around110 (+200ms), settling by113 (+320ms). Candidate looks closed around107 (+80ms). The candidate's accelerated tail closure reproduces relative to both8-frame controls.

There is also a cautionary normal-trial difference: candidate109–110 visibly narrows relative to both controls and reopens at111. This matches the helper's brief clamp/reopen prediction, but visual crops alone cannot establish whether a perceptible phoneme was suppressed. The quiet-trial predicted risks at75/84/97 remain outside the captured image range; source context82 is insufficient to assess them.

Whole-frame context52/82/110/130 shows consistent human face, framing and speech-versus-closed states across runs, without an obvious gross face/eye distortion in these sampled frames. It does not prove every output frame or the entire portrait is unchanged. All whole-call RGBA hashes and full-frame JPEG hashes differ between baseline and repeat as well as candidate; exact pixel equality is therefore not an appropriate acceptance criterion. Some stochastic rendering variation remains.

Conclusion: the controlled replay supports that close2 accelerates the visible end-mouth settling on this fixture. It does not establish quiet-speech preservation, general quality, a production fix or live transport/playout behavior. Do not promote based only on these tail images. Next safe test is the separately prepared exact-input quiet68–101 capture, with unchanged model/threshold/open/debounce and8/2/8 controls, followed by audible speech/context review. Preserve the normal109–111 warning and evaluate before considering rollout.
