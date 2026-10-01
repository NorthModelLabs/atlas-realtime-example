# Isolated voice latency model probe — September 30, 2026

Purpose: determine whether the exact deployed model can emit a shorter initial batch fast enough to reduce the measured ~2.17 s Atlas delivery stage. This is a prerequisite experiment, not an end-to-end acceptance claim.

One new VM only: `atlas-stg-voice-latency-20260930`, project `atlas-stg-isolated-20260831`, zone `us-central1-b`, one L4 / g2-standard-16. Credential-free golden base image ID `8609613804461334935`. No external IP, existing staging private subnet, existing restricted staging worker service account. No new IAM or firewall grants. Compute maximum lifetime one hour; guest shutdown at 55 minutes and immediately after successful benchmark. Failed startup also shuts down.

Use the live main-security avatar image pinned to `sha256:f853fbd1dc92ae7a514e93107e3696e8009f74e929180ac361e2e28e9d52e7e4` and its unchanged runtime environment. The container is nonroot, read-only, capability-free, resource-limited, with guest firewall rules denying model-initiated traffic/metadata access. It receives only the public default demo face and a synthetic English audio fixture. No sidecar, registry registration, account/DB access, customer sessions or production routing. No change to any production image or ten-worker capacity.

Run 32-, 8-, and 16-frame requests against the loopback model stream endpoint, first cold then three warm repetitions. Use the same leading synthetic audio, truncate its real prefix to the requested frame count, then pad to 32 frames while varying `max_frames`. Both real-audio prefix length and requested output count vary, so this tests the proposed short-prefix pattern rather than isolating one parameter. Validate each binary frame's dimensions and byte count, record first-frame and full-request duration. Short-batch output is not proof of sustainable conversation quality, state continuity, or E2E target success; those need a later isolated transport rehearsal.

Prepared startup SHA-256: `9969dca75a139a51d07c4a39c3b94eb27e0955c6e042c3521a9adebb65776df0` (234296 bytes). Private startup/config artifacts are in `/private/tmp/atlas-voice-stage-probe-20260930`; no credentials are embedded in the startup. The guest obtains a short-lived registry token through its existing metadata identity. No token is emitted.

Before creation: verify no active staging GPU VM, new name absent, golden image still ready, main pool still ten ready. Record native create operation and poll that operation rather than restart on timeout. After benchmark: verify VM stopped, collect sanitized numeric results, and remove the owned VM/disk if no further test is needed. All production resources remain unchanged.

Initial create was rejected with HTTP 413 before allocation because a metadata value exceeded 262144 characters. The same guest source is now losslessly gzip encoded to fit; no benchmark or model behavior changed.

## Instrumented browser results

Protected preview `demo-atlas-7ajkrdmz6-north-model-labs.vercel.app`, explicitly built with `NEXT_PUBLIC_VOICE_DIAGNOSTICS=true`. Production does not enable this flag. Diagnostics emit only numerical timing, audio-active transitions and selected RTP counters to the local browser console; no audio, transcripts, credentials, addresses or account identifiers.

One spoken trial: last non-silent microphone sample → first provider audio 1763 ms (includes VAD), browser bridge 9 ms, Atlas outgoing → returned audio 2181 ms. Three typed repetitions: provider 1098–1329 ms, bridge 9–28 ms, Atlas delivery 2160–2179 ms. These are small instrumented samples; they do not invalidate a user's faster live experience or establish a maximum/p95. RMS polling resolution is ~20 ms, and onset thresholds are documented in the JSON.

The bounded connection interval also recorded packet loss/concealment in provider audio and returned avatar audio, plus one 196 ms returned-video freeze. These counters establish that a continuity problem can occur, but do not isolate its cause to the model or map every concealed sample to audible speech. No buffering reduction has been deployed; reducing jitter protection blindly could worsen gaps. The owned instrumented session was deleted successfully.


## Warmup distinction and staging outcome

The captured live dispatcher configuration has background warmup enabled (45-second interval, 135-second freshness, 32-frame warmup). The runner also defaults to one startup warmup batch before publishing. Initial connection/warmup must be reported separately from replies in an established session. In the instrumented session, the three typed probes started at approximately 101, 109 and 118 seconds after observation began, after the first spoken reply; they were not initial connection times. This is still a narrow fixture/network sample and does not invalidate the user's very fast real conversation.

The second VM request was rejected before creation because Secure Boot was required. A retry matching the existing staging VM's Secure Boot/vTPM/integrity settings returned `UNAVAILABLE`. A subsequent authoritative instance list was empty for the exact probe name, and no matching native operation was listed. No model benchmark ran and no result is claimed. Do not substitute a production GPU or repeatedly allocate probes for this transient failure.

A concrete UI issue was identified: the Apple status was always Listening when the microphone was enabled, including while returned avatar speech played. The candidate now derives Speaking from the returned audio track, with a 300 ms release hold to avoid word-gap flicker. This observes audio only; it does not alter tracks, buffering, GPU settings, animation, or model weights. Browser acceptance remains pending.


## Spoken preview acceptance

Preview `demo-atlas-o5xyjkl7r-north-model-labs.vercel.app` passed repeated spoken math questions in one continuous connection. Four intended utterances plus two repeats from the looping fixture were observed before microphone mute and cleanup. All six returned English answers with no JavaScript errors; session, sharing and voice endpoints returned 200. The status changed to Speaking during returned audio and back after silence. The single owned session was deleted successfully (200).

The first response measured 3800 ms from the last voiced microphone sample to returned audio; subsequent samples measured 3638–4639 ms. These include provider/VAD and both transports. They are synthetic-microphone measurements in a headless browser, not a maximum, p95, or characterization of the user's faster live experience. Connection startup was separate (~2.8 s to returned-track attachment). Later turns began 29–113 seconds into observation, so initial connection warmup alone does not explain this fixture's timings. Browser bridging stayed 2–23 ms.

The fourth reply contained two ~703 ms pauses already in provider audio; returned audio pauses were ~541/760 ms. The fifth had a ~421 ms provider pause and ~399 ms returned pause. Therefore these particular pauses were not introduced solely by avatar rendering. Packet-loss/concealment counters and video freezes were also present, so natural provider phrasing versus transport interruption remains unresolved. Counters cover whole turn intervals, not exclusively voiced speech; do not equate them directly with a lost word. The correlated GPU had median 24.40 batch FPS and brief speech backpressure. None of these observations justifies replacing or changing the production model.

TypeScript, six capability/caption tests, preview production build and diff whitespace checks passed. Focused lint has no errors and one pre-existing hook dependency warning. The change observes returned audio for a status label only. Preview-only diagnostic collection remains off unless the explicit build flag is true. No GPU tuning, account/key changes, model deployment, or suppression of idle animation is included.


## Published status correction

Demo-only deployment `dpl_7CQ53P2EFj6BjX56qvVajJA2LXAb`, runtime `0a46733690550f69dd5083d820f53ba6aa030e64`, is now assigned to demo.northmodellabs.com. Previous deployment `dpl_BmQfZxuWAiUhSk4DNm5Vt1xpKGxp` remains the rollback. The exact unaliased production candidate and public deployment both passed a fresh spoken question with correct user/assistant captions, Speaking → Listening transitions, zero diagnostic events and zero JavaScript errors. Each owned test session was deleted successfully. Public root/config/icon returned 200; icon bytes match the requested white-interior asset. Dashboard aliases, project settings and deployment target were unchanged (comparison excludes only observation timestamps). No production GPU configuration, model image, existing key or customer row was changed.

Source is backed up in `.local/demo-quality-20260930/status-source.bundle` and pushed to the existing demo repair PR branch. The PR remains separate from the legacy main-branch auto-deployment project. The status fix does not claim to eliminate upstream pauses, network loss, GPU backpressure or lingering mouth motion. Those remain investigation items; cold and warm timing must continue to be reported separately.


## Direct warmup health finding (02:16 UTC October 1)

Warmup **enabled** does not establish warmup **working**. All ten main-security pods were ready, with zero container restarts since September 24. Five idle workers (0, 1, 6, 7, 8) had recent successful background warmups. Worker 2 had an approximately 5.4-day-old success timestamp. Idle workers 3, 4, 5 and 9 had no recorded successful background warmup and reported ReadTimeout. Sampled model health endpoints all returned ok; this does not prove stream inference is healthy on every worker. No new model request, restart, drain or configuration change was issued during these reads.

Worker 2 telemetry showed `warmup_cancel_for_launch` immediately after its final `warmup_ok`, with no later warmup success. The deployed dispatcher awaits the child warmup request in its loop and propagates CancelledError. Cancelling that child for a new customer launch can therefore terminate the parent warmup loop. A local test executes the extracted deployed methods and reproduces this behavior. The candidate catches child cancellation only when the parent task itself is not cancelling, preserving shutdown cancellation. The test verifies survival, skipping work during a customer session, resuming afterward, and cancelling both loop/request on shutdown. This supports the cancellation diagnosis for the stale worker; it does **not** explain the separate four workers' repeated read timeouts.

The candidate patch is pinned to the exact deployed source hash and is local only. It is not a rebuilt/validated production artifact. The shared backend checkout contains concurrent unrelated edits, so none of it was deployed or modified. No production model, dispatcher or sidecar digest was changed. The four stream timeouts, cancellation fix integration/staging acceptance and intermittent browser continuity remain open.


The local cancellation regression also passes under Python 3.11, matching the deployed dispatcher major/minor version (3.11.16). Its minimal unchanged deployed-method fixture is included; run `python3.11 docs/voice-stage-probe/check-warmup-cancellation.py`. This runs fake asynchronous warmup operations only, with no network, model or cloud access. Existing production warmup timeout errors are still not fixed. A first fixture comparison via a new exec process did not include variables exported by the startup shell and was not treated as configuration evidence; the follow-up reads only the running dispatcher's explicit non-secret fixture/URL fields.


The running-process check found different default warmup image bytes on successful worker 0 versus timeout worker 3 (hashes recorded in warmup-process-fixtures.json). Both files exist, and both use the code's default loopback model URL. This is a lead for isolated reproduction, not evidence that production model weights differ. Do not replace worker fixtures or model images based on it. Next steps: inspect warmup fixture metadata and stream-timeout logs read-only; reproduce on an isolated exact-digest worker when staging capacity is available; validate the cancellation patch against the exact dispatcher image without importing concurrent backend changes.
