"""Opt-in numeric timing hook for one owned staging generator; no app integration.

Observes decoded model-stream frame handoff, not model compute or HTTP arrival.
The caller separately marks its actual publication boundary. No media is copied,
replaced, dropped, delayed deliberately, or printed during the measured session.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import time

EXPECTED_RUNNER_SHA256 = '55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
ALLOWED_STAGES = frozenset(('decoded_frame_ready', 'enqueue_method_returned', 'enqueue_method_failed',
                            'generator_yield_video', 'generator_yield_audio', 'generator_segment_end',
                            'rtc_capture_video_begin', 'rtc_capture_video_end',
                            'rtc_capture_audio_begin', 'rtc_capture_audio_end', 'rtc_capture_failed'))


class StagingFrameTiming:
    def __init__(self, generator, runner_path: Path, *, max_events=30000, max_seconds=120):
        if hashlib.sha256(runner_path.read_bytes()).hexdigest() != EXPECTED_RUNNER_SHA256:
            raise ValueError('Runner source differs from preserved runtime')
        if not (1 <= max_events <= 50000 and 0 < max_seconds <= 180):
            raise ValueError('Capture limits exceed bounded staging scope')
        self.generator = generator
        self.original = generator._enqueue_stream_frame
        self.had_instance_method = '_enqueue_stream_frame' in vars(generator)
        self.prior = vars(generator).get('_enqueue_stream_frame')
        self.started_ns = time.monotonic_ns()
        self.started_epoch_ns = time.time_ns()
        self.max_events, self.max_seconds = max_events, max_seconds
        self.events, self.sequence, self.active_calls = [], 0, 0
        self.disabled_reason, self.closed = None, False
        self.wrapper = self._enqueue
        generator._enqueue_stream_frame = self.wrapper

    def mark(self, stage, sequence=None):
        """Manual marker for an actual boundary; never label generator yield as publish.

        Optional sequence is the caller's own numeric counter, not a customer ID.
        Local sequence domains must be documented; equal numbers across boundaries
        are not automatically proof of media-frame identity.
        """
        if self.closed or self.disabled_reason:
            return
        try:
            now = time.monotonic_ns()
            if len(self.events) >= self.max_events or now - self.started_ns > self.max_seconds * 1e9:
                self.disabled_reason = 'capture_limit_reached'
                return
            if stage not in ALLOWED_STAGES or (sequence is not None and (type(sequence) is not int or sequence < 0)):
                self.disabled_reason = 'invalid_numeric_marker'
                return
            self.events.append({'stage': stage, 'elapsed_ns': now - self.started_ns,
                                'sequence': sequence})
        except Exception as error:
            self.disabled_reason = 'capture_error:' + type(error).__name__

    async def _enqueue(self, *args, **kwargs):
        sequence = self.sequence
        self.sequence += 1
        self.active_calls += 1
        self.mark('decoded_frame_ready', sequence)
        try:
            result = await self.original(*args, **kwargs)
        except BaseException:
            self.mark('enqueue_method_failed', sequence)
            raise
        else:
            self.mark('enqueue_method_returned', sequence)
            return result
        finally:
            self.active_calls -= 1

    def close(self):
        if self.closed:
            return
        self.closed = True
        if self.generator._enqueue_stream_frame is self.wrapper:
            if self.had_instance_method:
                self.generator._enqueue_stream_frame = self.prior
            else:
                del self.generator._enqueue_stream_frame

    def export(self, path: Path):
        """Call after all producers/consumers stop; private exclusive output only."""
        if not self.closed or self.active_calls:
            raise RuntimeError('Stop owned producers/consumers and close capture before export')
        payload = {'scope': 'owned isolated staging generator only',
                   'runner_sha256': EXPECTED_RUNNER_SHA256,
                   'started_epoch_ns': self.started_epoch_ns,
                   'clock': 'monotonic elapsed nanoseconds; epoch is approximate cross-host alignment only',
                   'model_boundary': 'decoded frame ready immediately before original enqueue method',
                   'limits': {'max_events': self.max_events, 'max_seconds': self.max_seconds},
                   'disabled_reason': self.disabled_reason, 'enqueue_calls': self.sequence,
                   'events': self.events}
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(payload, f)
