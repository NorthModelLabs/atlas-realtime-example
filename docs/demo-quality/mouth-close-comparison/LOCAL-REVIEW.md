# Compact controlled replay review

Local preparation only. No cloud action or model execution by this reviewer.

`probe.py` consumes retained, verified baseline PCM directly: 368640 bytes per trial, 288 frames, nine original-runner inference calls with 32 frames each. Every condition consumes identical PCM hashes (26c3f4… full, 205fa6… quiet), avoiding fresh resampler dither between conditions. It asserts normalized model input equals paired input, and every returned audio frame equals its paired source. Each call records input/output fingerprints, frame counts and a producer hash of all decoded RGBA frames. Original runner SHA remains pinned. Baseline8/candidate2/repeat8 model configuration is supplied by the guarded guest, not altered by this probe.

The compact archive includes complete manifests, four 256px full frames and 66 consecutive 64×48 mouth crops per trial, using ROI x100/y96 at the 256px scale. Adaptive JPEG quality60/55/50/45/40 is explicit in each manifest; dimensions and frame counts never change to meet the strict <200000-byte cap. JPEG encoding uses optimized Huffman tables. Every serial line is <512 characters; payload pieces are320 characters. Both thresholds/reference and per-frame RMS are retained.

`analyze.py` requires the whole archive size/SHA, ZIP CRCs, exact expected file set, each image SHA, exact nine per-call PCM hashes recomputed from local fixtures, 288 RMS values, reference index105 and66 consecutive tail images. All three completion markers are separate from archive validity. Raw video hashes cannot be independently recomputed from reduced image evidence and are labeled producer receipts. Missing chunks prevent extraction/whole-archive acceptance.

`contact.py` requires archive-validated manifests, creates full/speech contacts and66-frame mouth-comparison GIF sequences at40ms/index. This is index playback, not measured live timing. Its images are scaled for inspection only.

Validation command:

`/private/tmp/atlas-eye-analysis-venv/bin/python /private/tmp/atlas-mouth-close-compact-20261001/test_compact.py`

Pass: actual archive producer + verifier exercised with retained baseline JPEGs and synthetic outcome hashes;193186bytes atJPEG55;141entries;805serial parts;longest line384characters. Exact PCM assembly/fingerprints/RMS verified. Truncated archive, wrong archive hash and altered PCM rejected. Derived contact test produced two66-frame GIFs with40ms frames; temporary synthetic outputs removed. These are local harness tests, not model results. Actual model imagery may compress differently; exceeding the cap raises without claiming acceptance.

Limits: direct synchronous inference bypasses ingress, live buffering, transport and playout. Trial1 is the existing −40dB synthetic attenuation, not a broad naturally quiet-speech sample. The shared reference uses baseline RMS>.001, while model threshold is.0001; both are retained so analysis can align to actual threshold runs. ABA ordering mitigates but does not eliminate model stochasticity/state carryover. Crops/JPEG can obscure tiny motion; preservation of speech and tail closure still require visual review. No promotion claim.
