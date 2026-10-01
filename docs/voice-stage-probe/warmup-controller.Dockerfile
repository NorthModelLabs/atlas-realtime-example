FROM us-central1-docker.pkg.dev/atlas-stg-isolated-20260831/atlas-stg-runtime/voice-warmup-base@sha256:830547f2c1dbc0ce536db1df26c34a3b3a61bd57bb5e88aab26146c4b786c4ee
USER 0
COPY patch.py /tmp/warmup-patch.py
COPY test_candidate.py /tmp/test_candidate.py
COPY --chown=1000:1000 warmup-face.jpg /workspace/warmup-face.jpg
RUN sha256sum /workspace/avatar_runner.py /workspace/mouth_mode.py /workspace/start-launcher.sh > /tmp/unchanged.sha256 && python /tmp/warmup-patch.py && sha256sum -c /tmp/unchanged.sha256 && python /tmp/test_candidate.py /workspace/dispatcher.py /workspace/warmup-face.jpg && chmod 0444 /workspace/warmup-face.jpg && rm /tmp/warmup-patch.py /tmp/test_candidate.py /tmp/unchanged.sha256
USER 1000
