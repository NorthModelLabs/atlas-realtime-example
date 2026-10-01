#!/usr/bin/env python3
"""Read-only audit of the preserved ten-worker human rendering configuration.

This never applies Kubernetes changes or selects a model by a mutable alias.
Run before and after any approved demo/rendering change. A passing audit must
still be paired with a live demo session and visual appearance check.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "docs/demo-quality/human-model-guard/expected.json"


def inspect(pods, expected):
    errors = []
    rows = []
    if len(pods) != expected["workers"]:
        errors.append("worker count differs from the preserved baseline")
    for pod in pods:
        name = pod["metadata"]["name"]
        failures = []
        statuses = pod.get("status", {}).get("containerStatuses", [])
        if pod["metadata"].get("deletionTimestamp"):
            failures.append("terminating")
        if not statuses or not all(c.get("ready") for c in statuses):
            failures.append("containers not ready")
        if not any(c.get("type") == "Ready" and c.get("status") == "True"
                   for c in pod.get("status", {}).get("conditions", [])):
            failures.append("pod not ready")
        digests = [c.get("imageID", "").split("@sha256:")[-1] for c in statuses]
        if sorted(digests) != sorted(expected["image_digests"]):
            failures.append("running image digest mismatch")
        model = next((c for c in pod["spec"]["containers"]
                      if c["name"] == expected["model_container"]), None)
        model_status = next((c for c in statuses
                             if c["name"] == expected["model_container"]), {})
        if not model or not model_status.get("imageID", "").endswith(
                "@sha256:" + expected["model_digest"]):
            failures.append("human model container mismatch")
        # Explicit digest pinning matters even when today's running image matches.
        for container in pod["spec"]["containers"]:
            if "@sha256:" not in container["image"] or container["image"].split(
                    "@sha256:")[-1] not in expected["image_digests"]:
                failures.append("desired image is not pinned to preserved digest")
        visual = {e["name"]: e.get("value", "<indirect>")
                  for e in (model or {}).get("env", [])
                  if e["name"].startswith(tuple(expected["visual_prefixes"]))}
        changed = sorted(k for k in set(visual) | set(expected["visual_settings"])
                         if visual.get(k) != expected["visual_settings"].get(k))
        if changed:
            failures.append("visual setting drift: " + ", ".join(changed))
        rows.append({"pod": name, "passed": not failures, "failures": failures,
                     "image_digests": sorted(digests),
                     "visual_settings_sha256": hashlib.sha256(
                         json.dumps(visual, sort_keys=True).encode()).hexdigest()})
        errors.extend(name + ": " + failure for failure in failures)
    return {"passed": not errors, "errors": errors, "workers": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Save non-secret audit evidence")
    args = parser.parse_args()
    expected = json.loads(BASELINE.read_text())
    command = ["kubectl", "--context=" + expected["context"], "-n", expected["namespace"],
               "get", "pods", "-l", expected["selector"], "-o", "json"]
    result = subprocess.run(command, capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise RuntimeError("Read-only Kubernetes audit failed; no changes attempted")
    report = inspect(json.loads(result.stdout)["items"], expected)
    report["observed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report["baseline_sha256"] = hashlib.sha256(BASELINE.read_bytes()).hexdigest()
    report["scope"] = "Read-only main human pool image and explicit visual-setting audit"
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
