"""Bounded PCM recorder for an owned, isolated staging runner instance only.

Install on one AvatarVideoGenerator created by the staging test harness, never
on a production process or the class globally. The caller owns session routing,
cleanup and a private output directory. No integration is enabled by importing.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time

EXPECTED_RUNNER_SHA256 = "55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec"


def _private_write(path: Path, data: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)


class RendererInputCapture:
    """Capture the exact method input; delegate the original objects unchanged.

    This boundary is after runner normalization, before model-side decoding and
    preprocessing. It is not a physical speaker recording or a latency probe.
    File I/O can perturb timings; do not compare its timings to production.
    """

    def __init__(self, generator, runner_path: Path, directory: Path,
                 *, max_bytes: int = 8 * 1024 * 1024, max_calls: int = 128):
        if hashlib.sha256(runner_path.read_bytes()).hexdigest() != EXPECTED_RUNNER_SHA256:
            raise ValueError("Runner source differs from the preserved image")
        if max_bytes <= 0 or max_calls <= 0:
            raise ValueError("Capture limits must be positive")
        directory.mkdir(mode=0o700, parents=False, exist_ok=False)
        self.generator = generator
        self.directory = directory
        self.original = generator._run_inference_streaming
        self.had_instance_method = "_run_inference_streaming" in vars(generator)
        self.prior_instance_method = vars(generator).get("_run_inference_streaming")
        self.max_bytes, self.max_calls = max_bytes, max_calls
        self.bytes_written = 0
        self.calls = 0
        self.calls_observed = 0
        self.completed_calls = 0
        self.pending_calls = set()
        self.disabled_reason = None
        self.closed = False
        self.wrapper = self._invoke
        generator._run_inference_streaming = self.wrapper

    async def _invoke(self, pcm_bytes, generation, *args, **kwargs):
        # Capture failures disable further recording, never alter the delegated
        # media call. The manifest makes incomplete evidence explicit.
        index = None
        self.calls_observed += 1
        if not self.disabled_reason and not self.closed:
            try:
                if type(pcm_bytes) is not bytes:
                    raise TypeError("Expected immutable PCM bytes")
                if args:
                    raise ValueError("Unrecognized positional media arguments")
                chunks = kwargs.get("audio_chunks")
                paired = None if chunks is None else b"".join(bytes(x.data) for x in chunks)
                size = len(pcm_bytes) + (len(paired) if paired is not None else 0)
                if self.calls >= self.max_calls or self.bytes_written + size > self.max_bytes:
                    self.disabled_reason = "capture_limit_reached"
                else:
                    index = self.calls
                    self.calls += 1
                    self.pending_calls.add(index)
                    pcm_name = f"{index:04d}-model-input.pcm"
                    _private_write(self.directory / pcm_name, pcm_bytes)
                    self.bytes_written += len(pcm_bytes)
                    row = {
                        "index": index, "generation": int(generation),
                        "observed_monotonic_ns": time.monotonic_ns(),
                        "model_input_file": pcm_name, "model_input_bytes": len(pcm_bytes),
                        "model_input_sha256": hashlib.sha256(pcm_bytes).hexdigest(),
                        "sample_rate": self.generator._options.audio_sample_rate,
                        "channels": self.generator._options.audio_channels,
                        "sample_format": "signed PCM16 little-endian",
                        "requested_frames": self.generator._context_window if chunks is None else len(chunks),
                        "paired_audio": None,
                    }
                    if paired is not None:
                        paired_name = f"{index:04d}-paired-audio.pcm"
                        _private_write(self.directory / paired_name, paired)
                        self.bytes_written += len(paired)
                        row["paired_audio"] = {
                            "file": paired_name, "bytes": len(paired),
                            "sha256": hashlib.sha256(paired).hexdigest(),
                            "frames": len(chunks),
                            "sample_rates": sorted({x.sample_rate for x in chunks}),
                            "channels": sorted({x.num_channels for x in chunks}),
                            "samples_per_channel": [x.samples_per_channel for x in chunks],
                        }
                    _private_write(self.directory / f"{index:04d}.json",
                                   (json.dumps(row, indent=2) + "\n").encode())
            except Exception as error:
                # Avoid putting arguments or private payloads in error text.
                self.disabled_reason = "capture_error:" + type(error).__name__
        try:
            result = await self.original(pcm_bytes, generation, *args, **kwargs)
        except BaseException as error:
            # Includes cancellation. Record only the type, never private exception
            # text, and preserve the original exception/traceback for the caller.
            self._record_outcome(index, None, type(error).__name__)
            raise
        else:
            self._record_outcome(index, result, None)
            return result

    def _record_outcome(self, index, result, exception_type):
        if index is None:
            return
        try:
            _private_write(self.directory / f"{index:04d}-outcome.json", (json.dumps({
                "index": index,
                "completed_monotonic_ns": time.monotonic_ns(),
                "returned_frames": result if type(result) is int else None,
                "exception_type": exception_type,
                "closed_before_outcome": self.closed,
            }, indent=2) + "\n").encode())
            self.completed_calls += 1
        except Exception as error:
            self.disabled_reason = self.disabled_reason or "outcome_error:" + type(error).__name__
        finally:
            self.pending_calls.discard(index)

    def close(self):
        if self.closed:
            return
        self.closed = True
        if self.generator._run_inference_streaming is self.wrapper:
            if self.had_instance_method:
                self.generator._run_inference_streaming = self.prior_instance_method
            else:
                del self.generator._run_inference_streaming
        _private_write(self.directory / "manifest.json", (json.dumps({
            "runner_sha256": EXPECTED_RUNNER_SHA256,
            "calls_observed": self.calls_observed,
            "calls_reserved": self.calls,
            "outcomes_written": self.completed_calls,
            "pending_calls_at_close": sorted(self.pending_calls),
            "pcm_bytes_written": self.bytes_written,
            "max_pcm_bytes": self.max_bytes,
            "max_calls": self.max_calls,
            "disabled_reason": self.disabled_reason,
            "scope": "owned isolated staging generator only",
            "boundary": "runner inference method input before model-side processing",
        }, indent=2) + "\n").encode())
