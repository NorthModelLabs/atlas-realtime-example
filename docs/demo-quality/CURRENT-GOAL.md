# Current demo quality goal — October 1, 2026

The user's latest instructions supersede the earlier latency target. Work on both:

1. Lingering mouth movement after the avatar finishes speaking. Compare actual returned audio ending with the subsequent rendered frames; reproduce, fix the demonstrated cause, and visually verify repeated turns.
2. Occasional playback glitches, stutters or cutoffs. Correlate visible/audio discontinuities with available playback and transport evidence and fix the demonstrated cause.

Preserve the fast response the user already experiences. General latency reduction, smaller inference batches, and pursuing a 1.3-second benchmark are out of scope. Do not freeze the entire avatar to conceal the mouth issue or truncate speech to make the end appear earlier.

Validate fixes in isolation before promotion, preserve existing customer records/keys and all production GPU/model image digests, and clean up owned test sessions. Neither issue is currently verified fixed. Previously completed latency experiments are historical evidence, not a reason to continue that work.

The active goal tracker was created for item 1 immediately before item 2 was added. Its available update operation supports status only, so this document records the expanded scope without falsely completing the unfinished goal. Completion requires both items above.


Latest evidence (08:58 UTC): the exact-image paired GPU comparison is complete. Current visual gate settings reproduce lingering mouth articulation with a 1.28-second faint-noise tail; threshold 0.0003 removes that tail in the controlled rendered samples. Eight trials preserve output audio byte-for-byte; 78/80 selected images were retained and hash-verified, with two missing images explicitly marked. Model weights, image hashes and timing controls are unchanged. Quiet-speech envelope testing exposes a possible articulation tradeoff, so the candidate is not promoted and still needs quiet-speech visual regression plus normal conversational acceptance.

The second owned browser call also captures packet loss/retransmission/keyframe recovery during a visible video stall while GPU rendering continues; the precise failing hop remains unproven. Human appearance and all ten main production image pins remain checked. See [root-cause controls, logs and comparisons](gate-and-recovery/README.md). The browser session is deleted; the completed staging VM and its boot disk were deleted and verified absent. The final production health check passed at 08:58:06 UTC. No production fix is claimed.

Preservation recheck (09:11 UTC): all ten main human workers match the original image pins and explicit eye/head/mouth/motion settings. A fresh public demo session visually showed the expected human face and traced to main-security worker 5; the session was deleted successfully. The reusable read-only [human-model guard](human-model-guard/README.md) must accompany future changes. Quiet-speech visual comparison is in progress on a separate one-GPU staging probe; production remains unchanged.
