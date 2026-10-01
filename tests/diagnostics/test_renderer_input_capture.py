import asyncio
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest

spec = importlib.util.spec_from_file_location("capture", Path(__file__).parents[2] / "scripts/diagnostics/renderer_input_capture.py")
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)

class Generator:
    def __init__(self):
        self._options = types.SimpleNamespace(audio_sample_rate=16000, audio_channels=1)
        self.received = []
        self.result = object()
    async def _run_inference_streaming(self, *args, **kwargs):
        self.received.append((args, kwargs))
        return self.result

class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "runner.py"
        self.source.write_bytes(b"owned synthetic test double")
        self.original_hash = capture.EXPECTED_RUNNER_SHA256
        capture.EXPECTED_RUNNER_SHA256 = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.addCleanup(setattr, capture, "EXPECTED_RUNNER_SHA256", self.original_hash)
        self.addCleanup(self.temp.cleanup)
        self.g = Generator()
        self.chunk = types.SimpleNamespace(data=b"\x01\x00\x02\x00", sample_rate=16000, num_channels=1, samples_per_channel=2)

    def test_records_exact_normalized_and_paired_bytes_without_replacing_arguments(self):
        c = capture.RendererInputCapture(self.g, self.source, self.root / "capture")
        pcm = self.chunk.data + bytes(4)
        frames = [self.chunk]
        result = asyncio.run(self.g._run_inference_streaming(pcm, 7, audio_chunks=frames))
        self.assertIs(result, self.g.result)
        self.assertIs(self.g.received[0][0][0], pcm)
        self.assertIs(self.g.received[0][1]["audio_chunks"], frames)
        c.close(); c.close()
        p = self.root / "capture"
        self.assertEqual((p / "0000-model-input.pcm").read_bytes(), pcm)
        self.assertEqual((p / "0000-paired-audio.pcm").read_bytes(), self.chunk.data)
        self.assertEqual((p / "0000-model-input.pcm").stat().st_mode & 0o777, 0o600)
        self.assertEqual(p.stat().st_mode & 0o777, 0o700)
        row = json.loads((p / "0000.json").read_text())
        self.assertEqual(row["paired_audio"]["samples_per_channel"], [2])
        self.assertEqual(row["model_input_sha256"], hashlib.sha256(pcm).hexdigest())
        self.assertNotIn("_run_inference_streaming", vars(self.g))

    def test_budget_exhaustion_keeps_all_media_calls_unchanged(self):
        c = capture.RendererInputCapture(self.g, self.source, self.root / "capture", max_calls=1)
        for _ in range(3):
            result = asyncio.run(self.g._run_inference_streaming(b"\x00\x00", 0, audio_chunks=None))
            self.assertIs(result, self.g.result)
        c.close()
        self.assertEqual(len(self.g.received), 3)
        self.assertEqual(c.disabled_reason, "capture_limit_reached")
        self.assertEqual(len(list(c.directory.glob('*-model-input.pcm'))), 1)

    def test_recorder_io_failure_does_not_swallow_model_exception_or_drop_call(self):
        c = capture.RendererInputCapture(self.g, self.source, self.root / "capture")
        (c.directory / "0000-model-input.pcm").write_bytes(b"collision")
        marker = RuntimeError("synthetic inference failure")
        async def failed(*args, **kwargs):
            raise marker
        c.original = failed
        with self.assertRaises(RuntimeError) as raised:
            asyncio.run(self.g._run_inference_streaming(b"\x00\x00", 0, audio_chunks=None))
        self.assertIs(raised.exception, marker)
        self.assertEqual(c.disabled_reason, "capture_error:FileExistsError")
        c.close()

    def test_wrong_source_is_rejected_before_hooking_or_writing(self):
        self.source.write_bytes(b"different build")
        with self.assertRaises(ValueError):
            capture.RendererInputCapture(self.g, self.source, self.root / "capture")
        self.assertFalse((self.root / "capture").exists())
        self.assertNotIn("_run_inference_streaming", vars(self.g))

if __name__ == '__main__': unittest.main()
