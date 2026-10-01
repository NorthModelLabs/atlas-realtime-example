# Current demo quality goal — October 1, 2026

The user's latest instructions supersede the earlier latency target. Work on both:

1. Lingering mouth movement after the avatar finishes speaking. Compare actual returned audio ending with the subsequent rendered frames; reproduce, fix the demonstrated cause, and visually verify repeated turns.
2. Occasional playback glitches, stutters or cutoffs. Correlate visible/audio discontinuities with available playback and transport evidence and fix the demonstrated cause.

Preserve the fast response the user already experiences. General latency reduction, smaller inference batches, and pursuing a 1.3-second benchmark are out of scope. Do not freeze the entire avatar to conceal the mouth issue or truncate speech to make the end appear earlier.

Validate fixes in isolation before promotion, preserve existing customer records/keys and all production GPU/model image digests, and clean up owned test sessions. Neither issue is currently verified fixed. Previously completed latency experiments are historical evidence, not a reason to continue that work.

The active goal tracker was created for item 1 immediately before item 2 was added. Its available update operation supports status only, so this document records the expanded scope without falsely completing the unfinished goal. Completion requires both items above.


Latest evidence (08:13 UTC): both symptoms are reproduced in owned browser calls. The exact-model clean-silence capture closed the mouth by the 400 ms sample across three trials. A faint-noise input control was prepared but did not execute because both staging start attempts failed for L4 capacity. Two observed playback stalls include approximately 91/130 ms additional post-capture delivery delay; the exact sender/transport location is unresolved. No runtime fix is claimed. The owned GPU and boot disk were deleted, production health and ten main image pins verified unchanged. See [correlated findings](frame-trace/README.md) and [raw model frames](model-tail/README.md).
