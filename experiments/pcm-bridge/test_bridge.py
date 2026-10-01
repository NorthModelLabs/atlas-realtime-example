import asyncio
import base64
import json
import unittest

from bridge import BridgeError, PcmBridge
from livekit_ingress import register


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    async def sleep(self, delay):
        self.now += delay
        await asyncio.sleep(0)


class Sink:
    def __init__(self, clock):
        self.clock = clock
        self.writes = []
        self.events = []
        self.entered = asyncio.Event()
        self.hold = None
        self.fail_write = self.fail_clear = False

    async def write(self, data):
        self.entered.set()
        if self.hold:
            await self.hold.wait()
        if self.fail_write:
            raise RuntimeError("private sink detail")
        self.writes.append((self.clock(), data))
        self.events.append(("write", data[:2]))

    async def clear(self):
        self.events.append(("clear",))
        if self.fail_clear:
            raise RuntimeError("private clear detail")


class BridgeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.loop_errors = []
        asyncio.get_running_loop().set_exception_handler(lambda _loop, context: self.loop_errors.append(context))
        self.clock = Clock()
        self.sink = Sink(self.clock)
        self.bridge = PcmBridge("driver-owned", self.sink, enabled=True,
                                clock=self.clock, sleep=self.clock.sleep,
                                operation_timeout=.2, ack_timeout=.4)
        self.generation = (await self.rpc("open", turn="response_1"))["generation"]

    async def asyncTearDown(self):
        self.sink.fail_clear = False
        await self.bridge.close()
        await asyncio.sleep(0)
        self.assertEqual(self.loop_errors, [], "Unobserved task/future exceptions")

    async def rpc(self, op, **fields):
        return json.loads(await self.bridge.handle("driver-owned", json.dumps({"op": op, **fields})))

    async def push(self, seq, data=b"\x01\x01" * 4800, generation=None):
        return await self.rpc("push", generation=generation or self.generation,
                              seq=seq, pcm=base64.b64encode(data).decode())

    async def test_opt_in_and_authenticated_driver_are_required(self):
        for driver, enabled in [("driver-owned", False), ("", True), ("viewer-a", True), ("avatar", True)]:
            with self.assertRaises(BridgeError):
                PcmBridge(driver, self.sink, enabled=enabled)
        for caller in ["viewer-a", "driver-other", "avatar", ""]:
            with self.assertRaisesRegex(BridgeError, "Unauthorized"):
                await self.bridge.handle(caller, "not even JSON")
        self.assertEqual(self.sink.writes, [])

    async def test_adapter_is_inert_by_default_and_rejects_media_mode(self):
        self.assertIsNone(register(None, "driver-owned", self.sink))
        with self.assertRaisesRegex(BridgeError, "exclusive PCM"):
            register(None, "driver-owned", self.sink, enabled=True)

    async def test_out_of_order_window_delivers_ordered_exact_samples(self):
        tasks = []
        for seq in [2, 1, 0, 3]:
            tasks.append(asyncio.create_task(self.push(seq, bytes([seq + 1, 0]) * 4800)))
            await asyncio.sleep(0)
        await asyncio.gather(*tasks)
        self.assertEqual([data for _, data in self.sink.writes],
                         [bytes([i + 1, 0]) * 4800 for i in range(4)])
        self.assertEqual(self.bridge.next_seq, 4)
        self.assertFalse(self.bridge.pending)

    async def test_duplicate_ack_is_idempotent_but_conflicting_retry_rejected(self):
        result = await self.push(0)
        self.assertEqual(await self.push(0), result)
        with self.assertRaisesRegex(BridgeError, "Conflicting"):
            await self.push(0, b"\x02\x02" * 4800)
        self.assertEqual(len(self.sink.writes), 1)

    async def test_buffer_window_and_duplicate_inflight_are_bounded(self):
        self.sink.hold = asyncio.Event()
        tasks = [asyncio.create_task(self.push(i)) for i in range(4)]
        await self.sink.entered.wait()
        self.assertLessEqual(sum(len(c.data) for c in self.bridge.pending.values()), 38400)
        with self.assertRaisesRegex(BridgeError, "window"):
            await self.push(4)
        with self.assertRaisesRegex(BridgeError, "already in flight"):
            await self.push(0)
        self.sink.hold.set()
        await asyncio.gather(*tasks)

    async def test_cancellation_fences_inflight_audio_before_next_turn(self):
        self.sink.hold = asyncio.Event()
        old = asyncio.create_task(self.push(0))
        await self.sink.entered.wait()
        await self.rpc("cancel", generation=self.generation)
        with self.assertRaisesRegex(BridgeError, "cancelled"):
            await old
        new = (await self.rpc("open", turn="response_2"))["generation"]
        self.sink.hold.set()
        with self.assertRaisesRegex(BridgeError, "Stale"):
            await self.push(0, generation=self.generation)
        await self.push(0, b"\x02\x00" * 4800, generation=new)
        self.assertEqual(self.sink.events, [("clear",), ("write", b"\x02\x00")])

    async def test_failed_clear_prevents_reopening(self):
        self.sink.fail_clear = True
        with self.assertRaisesRegex(BridgeError, "reconnect required"):
            await self.rpc("cancel", generation=self.generation)
        with self.assertRaisesRegex(BridgeError, "closed"):
            await self.rpc("open", turn="response_2")

    async def test_close_rejects_new_work_while_clear_is_pending(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def slow_clear():
            entered.set()
            await release.wait()
        self.sink.clear = slow_clear
        closing = asyncio.create_task(self.bridge.close())
        await entered.wait()
        with self.assertRaisesRegex(BridgeError, "closed"):
            await self.rpc("open", turn="response_2")
        release.set()
        await closing
        with self.assertRaisesRegex(BridgeError, "closed"):
            await self.rpc("open", turn="response_2")

    async def test_missing_packet_times_out_and_clears_instead_of_skipping_speech(self):
        self.bridge.ack_timeout = .02
        with self.assertRaisesRegex(BridgeError, "timed out"):
            await self.push(1)
        self.assertEqual(self.sink.writes, [])
        self.assertEqual(self.bridge.phase, "idle")
        self.assertFalse(self.bridge.pending)
        self.assertEqual(self.sink.events, [("clear",)])

    async def test_sink_failure_is_sanitized_and_fails_closed(self):
        self.sink.fail_write = True
        with self.assertRaisesRegex(BridgeError, "sink failed") as error:
            await self.push(0)
        self.assertNotIn("private", str(error.exception))
        with self.assertRaisesRegex(BridgeError, "closed"):
            await self.rpc("open", turn="response_2")
        await asyncio.sleep(0)
        self.assertIn(("clear",), self.sink.events)

    async def test_partial_tail_is_padded_without_a_stream_close(self):
        data = b"\x03\x00" * 240  # 10ms short speech.
        await self.push(0, data)
        with self.assertRaisesRegex(BridgeError, "missing chunks"):
            await self.rpc("end", generation=self.generation, count=2)
        result = await self.rpc("end", generation=self.generation, count=1)
        combined = b"".join(x[1] for x in self.sink.writes)
        self.assertEqual(combined, data + bytes(61440 - len(data)))
        self.assertEqual(result, {"sealed": True, "forwarded_samples": 30720})
        self.assertFalse(any(x[0] == "clear" for x in self.sink.events))
        before = len(self.sink.writes)
        self.assertEqual(await self.rpc("end", generation=self.generation, count=1), result)
        self.assertEqual(len(self.sink.writes), before)
        with self.assertRaises(BridgeError):
            await self.push(1)

    async def test_cumulative_ahead_limit_starts_at_first_audio_not_open(self):
        self.clock.now = 100  # Provider/model response takes time after opening.
        for seq in range(15):
            await self.push(seq)
        sent = 0
        for at, data in self.sink.writes:
            sent += len(data)
            self.assertLessEqual(sent / 48000 - (at - 100), 1.280001)
        self.assertAlmostEqual(self.clock.now, 101.72)

    async def test_turn_duration_limit_rejects_extra_audio(self):
        self.bridge.MAX_TURN_BYTES = 19200
        await self.push(0)
        await self.push(1)
        with self.assertRaisesRegex(BridgeError, "duration limit"):
            await self.push(2)
        self.assertEqual(sum(len(x[1]) for x in self.sink.writes), 19200)

    async def test_invalid_payloads_never_reach_sink(self):
        for payload in ["[]", "null", "\"x\"", "{", " " * 15000,
                        json.dumps({"op": "open", "turn": "a", "sample_rate": 16000})]:
            with self.assertRaises(BridgeError):
                await self.bridge.handle("driver-owned", payload)
        for seq, pcm in [(True, "AAAA"), (-1, "AAAA"), (0, "?"), (0, "AQ=="),
                         (0, ""), (0, "AAAA" * 4000)]:
            with self.assertRaises(BridgeError):
                await self.rpc("push", generation=self.generation, seq=seq, pcm=pcm)
        self.assertEqual(self.sink.writes, [])


if __name__ == "__main__":
    unittest.main()
