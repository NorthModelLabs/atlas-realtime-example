import asyncio
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('timing', Path(__file__).with_name('staging_frame_timing.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class Generator:
    def __init__(self): self.received = []
    async def _enqueue_stream_frame(self, *args, **kwargs):
        self.received.append((args, kwargs)); return 17


class TimingTests(unittest.IsolatedAsyncioTestCase):
    def hook(self, g, **kwargs):
        path = type('Path', (), {'read_bytes': lambda self: b'test'})()
        with patch.object(m, 'EXPECTED_RUNNER_SHA256', m.hashlib.sha256(b'test').hexdigest()):
            return m.StagingFrameTiming(g, path, **kwargs)

    async def test_delegates_original_objects_and_restores_method(self):
        g = Generator(); original = g._enqueue_stream_frame
        h = self.hook(g); image, audio = object(), object()
        self.assertEqual(await g._enqueue_stream_frame(image, audio_chunks=audio), 17)
        self.assertIs(g.received[0][0][0], image)
        self.assertIs(g.received[0][1]['audio_chunks'], audio)
        h.close(); self.assertEqual(g._enqueue_stream_frame, original)
        self.assertEqual([e['stage'] for e in h.events], ['decoded_frame_ready', 'enqueue_method_returned'])

    async def test_cap_does_not_stop_media(self):
        g = Generator(); h = self.hook(g, max_events=1)
        for _ in range(3): self.assertEqual(await g._enqueue_stream_frame(object()), 17)
        self.assertEqual(len(g.received), 3); self.assertEqual(len(h.events), 1)
        self.assertEqual(h.disabled_reason, 'capture_limit_reached'); h.close()

    async def test_cancellation_preserved(self):
        g = Generator()
        async def cancelled(*args, **kwargs): raise asyncio.CancelledError()
        g._enqueue_stream_frame = cancelled
        h = self.hook(g)
        with self.assertRaises(asyncio.CancelledError): await g._enqueue_stream_frame(object())
        self.assertEqual(h.active_calls, 0)
        self.assertEqual(h.events[-1]['stage'], 'enqueue_method_failed')
        h.close(); self.assertIs(g._enqueue_stream_frame, cancelled)

    async def test_requires_stopped_export_and_exclusive_private_file(self):
        h = self.hook(Generator())
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'timing.json'
            with self.assertRaises(RuntimeError): h.export(p)
            h.close(); h.export(p)
            self.assertEqual(p.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(p.read_text())['events'], [])
            with self.assertRaises(FileExistsError): h.export(p)

    async def test_wrong_runtime_refused(self):
        p = type('Path', (), {'read_bytes': lambda self: b'wrong'})()
        with self.assertRaises(ValueError): m.StagingFrameTiming(Generator(), p)


if __name__ == '__main__': unittest.main()
