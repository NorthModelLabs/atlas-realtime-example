# Idle mouth-strength comparison — pending runtime

No candidate is accepted or deployed. The purpose of this comparison is to test whether the remaining generated mouth deformation under the current 0.85 idle-lock blend can produce visible movement during prolonged exact-zero input. It is a hypothesis, not a conclusion from the existing browser measurements.

## Owned production-session correlation

The earlier late-reopening session `ses_eb8a23a8cf5448ecab45` ran on `avatar-pasteback-main-security-2`, with internal cache `lk_c13d9b22cecf`. A bounded read-only log query retained only this owned session's numeric timing records. Around the reopened frame, the runner continued returning full 32-frame batches; its log does not identify that frame's normalized audio samples or gate weight. This establishes routing and continued batch output, not causality or end-to-end latency. No batching optimization follows from it.

The matching model log identifies the owned cache initialization but has no framewise idle-envelope diagnostics in the observed window. No production instrumentation was added and no customer media was read. Full-transport normalized-input capture is still outstanding.

## Exact planned comparison

One isolated staging L4, original model digest `f853fbd1…` and runner digest `830547f2…`, fixed original face and speech fixture. Conditions are baseline mouth strength 0.85, isolated candidate strength 1.0, then baseline repeat 0.85. All other model and eye settings stay at baseline; the silence threshold and close/open/debounce timing are unchanged. Both normal and 0.01-gain speech are followed by more than nine seconds of exact-zero PCM.

`probe.py` uses the actual runner inference method, checks every paired output-audio byte against input, saves selected speech/tail images, and emits a bounded compressed archive of the private input/outcome captures. `analyze.py` verifies archive/file hashes, each requested/returned frame count, and total paired-audio equality against the submitted fixture. Raw PCM is kept privately and is not committed. This direct inference experiment does **not** include browser/LiveKit decoding or establish physical playout timing. The fixture's resampling uses the earlier approximate interpolation, not the actual runner resampler.

Runtime visual evidence must show a baseline symptom and an improvement without suppressing quiet articulation before considering this a useful candidate. Even a pass would still need repeated full-conversation visual acceptance. If the symptom is absent from the zero-input baseline, that result would not justify a production strength change; continue with the actual transport/input investigation.

## Capacity and cleanup

Four sequential requests were rejected with `ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS`: g2-standard-16 in us-central1-c, -a and -b; g2-standard-12 in -c. Each terminal rejection was followed by authoritative checks confirming that neither its VM nor boot disk existed. The remaining region zone -f does not expose g2-standard-12, so no request was made there. No GPU trial ran. The scripts and result analyzer are prepared, but they provide no renderer/visual result yet.

Every request used the isolated staging project, private networking without an external IP, one L4 maximum, original digest pins, a 30-minute cloud stop deadline and independent guest shutdown. See `capacity-failures.json`. No production GPU, model setting, route, account or key was changed. The public health watcher reported HTTP 200 throughout its observations and was stopped after the terminal failures.

All ten production workers and their controller passed the original image and visual-setting guard at 18:43:21 UTC. Capacity is the current blocker for this specific comparison. This is its first blocked goal turn; the goal remains active and unresolved. Do not count the prepared scripts or failed allocations as evidence that mouth strength fixes the symptom.

Final read-only release guard: 2026-10-01T18:53:41.321519+00:00. Ten main workers ready with original image hashes; demo/dashboard/API health HTTP 200; public demo alias and dashboard snapshot unchanged. See `release-health.json`.
