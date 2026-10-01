# Canonical mouth-only returned-A/V run (local preparation, not runtime acceptance)

Use this direct fixture variant instead of driver-mouth.py/browser-mouth-server.mjs.
It excludes browser-input WebRTC, live provider and WAN. It includes exact fixed
PCM → original data-stream SDK → original runner/model → pinned SFU → browser
returned decoded audio/video. No production or current replay VM is touched.

Prerequisites: the same pinned model/runner/SFU/browser from PLAN.md; original
runtime env/settings attested; isolated SFU reachable; fresh /scope credentials;
fresh private /control and /evidence shared only among these three owned
containers. Mount /probe and /scope read-only. Keep /control,/evidence mode0700
with the same runtime UID. Original face is /probe/face.jpg; exact full captured
multiple-turn fixture is mono PCM16 48kHz /probe/fixture.wav, <=110seconds.

Start these concurrent processes with the original pinned runner image's Python
(the first two) and the pinned browser image's Node (third):

```
python /probe/worker-mouth.py --config /scope/avatar.json --control /control --face /probe/face.jpg --output /evidence/worker.json --seconds 180
python /probe/driver-fixture.py --config /scope/driver.json --control /control --fixture /probe/fixture.wav --output /evidence/driver.json
node /probe/browser-mouth-direct-server.mjs
```

The driver first sends separately counted zero PCM only to prime lazy publishing
until both returned tracks exist and browser recording starts (35s bound). This
priming is excluded from fixture counts/hash. It then forwards exact WAV PCM bytes
in20ms frames, including all original silence and any partial final frame; no
padding, trimming or per-turn stream close. Pacing never drops late frames.
Browser does not publish microphone or fixture media in this variant.

On fixture EOF, worker is armed before driver closes the one final byte stream.
Driver awaits scheduled stream-close tasks. Worker observes final noninterrupted
segment notification then awaits SDK A/V playout. The generator/model's later idle
behavior is unchanged. Browser waits that barrier, records2.5seconds more, stops
recorder, saves returned.webm + returned-audio.json + browser.json, and only then
signals completion. Media stays private on host; never export it via serial/base64.

Run only after all three processes finish:

```
python /probe/mouth_report.py /evidence /probe/fixture.wav /evidence/mouth-summary.json
python /probe/compact_timing.py /evidence/worker.json /evidence/worker-summary.json
```

Mouth-summary requires matching fixture input/forwarded sample counts, verified
stream close + final segment + A/V drain, at least2 seconds contiguous observed
returned silence, multiple fixture activity spans, and no capture cap. It does
not award visual mouth acceptance: inspect returned.webm at every speech ending
and renewed speech onset. Verify natural closed mouth versus ongoing articulation
while allowing ordinary head/blink movement. Model/codec changes are not permitted
as workarounds. Missing/capped/timeout evidence is incomplete, never a pass.

Local verification:36 tests pass, including original SDK queue/pacing code,
exclusive room controls, ordered segment/drain barrier, exact byte forwarding
(including trailing zeros and partial frame), capture-error stop, sample mismatch,
truncation and callback-gap rejection. JS syntax checks pass. Native FFI,
MediaRecorder/AudioWorklet and pinned-container integration remain unexecuted.
Parent found no matching LiveKit mirror in current allowed staging repository;
original DockerHub pinned digest reachability remains an infrastructure blocker.

File integrity: mouth-harness-sha256.json includes this invocation and all runtime
files. Bundle only those runtime files, face.jpg and fixture.wav; SDK source wheels
and tests are local evidence and unnecessary on the staging host. Re-attest
original runner source SHA55807a14… (worker refuses any other), runner image
830547f2…, model f853fbd1…, SFU6fd3b708…, browser39c8d773… before running.


Report hardening: driver receipt must match BOTH the supplied WAV file SHA256 and
its decoded PCM SHA256; input and forwarded sample totals must each equal the
supplied fixture's full sample count. Equal-but-truncated counts fail. Browser
worker_drain_observed records the AudioContext sample index and sample rate;
only complete20ms RMS windows after that boundary contribute to the required
2-second silent tail. Callback wall-clock arrival cannot move earlier samples
past the boundary. Missing/duplicate drain markers and clock mismatch fail.
