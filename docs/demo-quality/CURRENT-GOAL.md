# Current demo quality goal — October 1, 2026

The user's latest instructions supersede the earlier latency target. Work on both:

1. Lingering mouth movement after the avatar finishes speaking. Compare actual returned audio ending with the subsequent rendered frames; reproduce, fix the demonstrated cause, and visually verify repeated turns.
2. Occasional playback glitches, stutters or cutoffs. Correlate visible/audio discontinuities with available playback and transport evidence and fix the demonstrated cause.

Preserve the fast response the user already experiences. General latency reduction, smaller inference batches, and pursuing a 1.3-second benchmark are out of scope. Do not freeze the entire avatar to conceal the mouth issue or truncate speech to make the end appear earlier.

Validate fixes in isolation before promotion, preserve existing customer records/keys and all production GPU/model image digests, and clean up owned test sessions. Neither issue is currently verified fixed. Previously completed latency experiments are historical evidence, not a reason to continue that work.

The active goal tracker was created for item 1 immediately before item 2 was added. Its available update operation supports status only, so this document records the expanded scope without falsely completing the unfinished goal. Completion requires both items above.


Latest evidence (08:40 UTC): a second owned call reproduced the open-mouth tail at 830 ms. Exact-image CPU execution confirms that faint RMS 6 PCM16 units can hold the mouth-close envelope open: 1.64 seconds to full weight with the production threshold versus 0.36 seconds on clean silence. This is a demonstrated mechanism, not yet attribution of the browser symptom. The new packet-recovery trace shows a 3.283-second silence-period video stall with lost packets, 111 NACKs and a keyframe request while GPU batches continue normally; a separate voice connection loses packets in the same window. The failing network hop remains unknown. See [new controls and logs](gate-and-recovery/README.md).

One bounded staging GPU in zone c is running the paired rendered comparison after zone-a capacity failures. It uses the exact images, no production connections, and a 30-minute stop deadline. The owned browser session is deleted. No production fix is claimed; original model hashes and human-avatar appearance remain verified. Complete the visual comparison, quiet-speech regression check and staging cleanup before any promotion.
