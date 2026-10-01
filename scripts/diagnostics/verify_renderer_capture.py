"""Validate private inference capture completeness without printing media.

Passing checks only accounts for calls reaching the captured inference method.
The harness must separately account for decoded input, segment end and playout.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def verify(directory: Path) -> dict:
    manifest = json.loads((directory / "manifest.json").read_text())
    calls = manifest["calls_reserved"]
    errors = []
    if not isinstance(calls, int) or calls <= 0:
        raise ValueError("No captured inference calls")
    if manifest.get("disabled_reason"):
        errors.append("recorder_disabled")
    if manifest.get("calls_observed") != calls:
        errors.append("uncaptured_calls")
    if manifest.get("outcomes_written") != calls:
        errors.append("missing_outcomes")
    if manifest.get("pending_calls_at_close") != []:
        errors.append("calls_pending_at_close")
    total_bytes = 0
    paired_frames = 0
    idle_frames = 0

    def media(name, size, sha):
        nonlocal total_bytes
        raw = (directory / name).read_bytes()
        total_bytes += len(raw)
        if len(raw) != size or hashlib.sha256(raw).hexdigest() != sha:
            raise ValueError("PCM integrity mismatch")
        return raw

    for index in range(calls):
        try:
            row = json.loads((directory / f"{index:04d}.json").read_text())
            outcome = json.loads((directory / f"{index:04d}-outcome.json").read_text())
            if row["index"] != index or outcome["index"] != index:
                raise ValueError("Call index mismatch")
            # Read only generated names, never a path supplied by metadata.
            name = f"{index:04d}-model-input.pcm"
            if row["model_input_file"] != name:
                raise ValueError("Input name mismatch")
            raw = media(name, row["model_input_bytes"], row["model_input_sha256"])
            returned = outcome["returned_frames"]
            if (type(returned) is not int or returned <= 0
                    or returned != row["requested_frames"]
                    or outcome["exception_type"] is not None
                    or outcome["closed_before_outcome"]):
                raise ValueError("Incomplete inference outcome")
            paired = row["paired_audio"]
            if paired is None:
                idle_frames += returned
                continue
            name = f"{index:04d}-paired-audio.pcm"
            if paired["file"] != name:
                raise ValueError("Paired name mismatch")
            audio = media(name, paired["bytes"], paired["sha256"])
            samples = paired["samples_per_channel"]
            if (returned != paired["frames"] or len(samples) != returned
                    or paired["sample_rates"] != [row["sample_rate"]]
                    or paired["channels"] != [row["channels"]]
                    or sum(samples) * row["channels"] * 2 != len(audio)
                    or len(raw) < len(audio) or raw[:len(audio)] != audio):
                raise ValueError("Paired input/output accounting mismatch")
            paired_frames += returned
        except (OSError, ValueError, KeyError, TypeError):
            errors.append(f"call_{index:04d}_incomplete_or_inconsistent")
    if total_bytes != manifest["pcm_bytes_written"]:
        errors.append("pcm_byte_accounting_mismatch")
    return {
        "inference_calls_accounted": not errors,
        "errors": errors,
        "calls": calls,
        "paired_frames": paired_frames,
        "idle_frames": idle_frames,
        "pcm_bytes_checked": total_bytes,
        "full_transport_drain_verified": False,
        "scope": "Captured inference calls only; decoded ingress and final playout need separate evidence",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    result = verify(args.directory)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["inference_calls_accounted"] else 1)
