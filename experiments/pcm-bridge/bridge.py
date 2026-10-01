"""Experimental, SDK-independent PCM ingress. Not loaded by the deployed demo.

An adapter must supply LiveKit's authenticated caller identity and a sink whose
clear() ACK fences prior audio at the receiver. Forwarding ACK != playback ACK.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import json
import re
import secrets
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Protocol


class BridgeError(Exception):
    pass


class Sink(Protocol):
    async def write(self, pcm: bytes) -> None: ...
    async def clear(self) -> None: ...


@dataclass
class Chunk:
    data: bytes
    digest: str
    ack: asyncio.Future


class PcmBridge:
    RATE = 24000
    BYTES_PER_SECOND = RATE * 2
    CHUNK_BYTES = 9600  # 200ms PCM16 mono, base64 fits a 15KiB RPC payload.
    WINDOW = 4
    MAX_TURN_BYTES = BYTES_PER_SECOND * 30
    MAX_PAYLOAD = 14 * 1024
    LOOKAHEAD_SECONDS = 1.28
    BATCH_BYTES = 61440  # 32 x 40ms at 24kHz; unchanged runner batch size.

    def __init__(self, driver: str, sink: Sink, *, enabled: bool = False,
                 clock: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], Awaitable] = asyncio.sleep,
                 operation_timeout: float = 3.0, ack_timeout: float = 5.0):
        if not enabled or not isinstance(driver, str) or not driver or driver.startswith(("viewer-", "avatar")):
            raise BridgeError("PCM ingress requires an explicit owned driver and opt-in")
        self.driver, self.sink = driver, sink
        self.clock, self.sleep = clock, sleep
        self.operation_timeout, self.ack_timeout = operation_timeout, ack_timeout
        self.phase = "idle"
        self.closing = False
        self.generation: str | None = None
        self.turn: str | None = None
        self.next_seq = self.accepted_bytes = self.forwarded_bytes = 0
        self.started: float | None = None
        self.pending: dict[int, Chunk] = {}
        self.recent: dict[int, tuple[str, dict]] = {}
        self.worker: asyncio.Task | None = None
        self.reset_task: asyncio.Task | None = None

    def _auth(self, caller: str):
        if caller != self.driver:
            raise BridgeError("Unauthorized PCM caller")
        if self.phase == "closed" or self.closing:
            raise BridgeError("PCM bridge closed")

    def _generation(self, value):
        if not isinstance(value, str) or value != self.generation:
            raise BridgeError("Stale PCM generation")

    @staticmethod
    def _fields(message, names):
        if set(message) != set(names):
            raise BridgeError("Unexpected PCM message fields")

    async def handle(self, caller: str, payload: str) -> str:
        self._auth(caller)  # Check before parsing or decoding untrusted data.
        if not isinstance(payload, str) or len(payload) > self.MAX_PAYLOAD:
            raise BridgeError("PCM message too large")
        if len(payload.encode("utf-8")) > self.MAX_PAYLOAD:
            raise BridgeError("PCM message too large")
        try:
            message = json.loads(payload)
        except (ValueError, RecursionError):
            raise BridgeError("Invalid PCM JSON") from None
        if not isinstance(message, dict):
            raise BridgeError("Invalid PCM message")
        op = message.get("op")
        if op == "open":
            self._fields(message, ("op", "turn"))
            result = self.open(message["turn"])
        elif op == "push":
            self._fields(message, ("op", "generation", "seq", "pcm"))
            self._generation(message["generation"])
            result = await self.push(message["seq"], message["pcm"])
        elif op == "end":
            self._fields(message, ("op", "generation", "count"))
            self._generation(message["generation"])
            result = await self.end(message["count"])
        elif op == "cancel":
            self._fields(message, ("op", "generation"))
            self._generation(message["generation"])
            await self.cancel()
            result = {"cancelled": True}
        else:
            raise BridgeError("Unknown PCM operation")
        return json.dumps(result, separators=(",", ":"))

    def open(self, turn):
        if not isinstance(turn, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", turn):
            raise BridgeError("Invalid turn identifier")
        if self.phase == "open" and turn == self.turn:
            return {"generation": self.generation, "next_seq": self.next_seq}
        if self.phase != "idle":
            raise BridgeError("Cancel the previous turn before opening another")
        self.phase, self.turn = "open", turn
        self.generation = secrets.token_hex(16)
        self.next_seq = self.accepted_bytes = self.forwarded_bytes = 0
        self.started = None
        self.pending.clear()
        self.recent.clear()
        return {"generation": self.generation, "next_seq": 0}

    async def push(self, seq, encoded):
        if self.phase != "open":
            raise BridgeError("PCM turn is not open")
        if type(seq) is not int or seq < 0:
            raise BridgeError("Invalid PCM sequence")
        if not isinstance(encoded, str) or not encoded or len(encoded) > 12800:
            raise BridgeError("Invalid PCM chunk length")
        try:
            pcm = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise BridgeError("Invalid PCM encoding") from None
        if not pcm or len(pcm) > self.CHUNK_BYTES or len(pcm) % 2:
            raise BridgeError("PCM must contain complete 16-bit samples")
        digest = hashlib.sha256(pcm).hexdigest()
        if seq < self.next_seq:
            previous = self.recent.get(seq)
            if previous and previous[0] == digest:
                return previous[1]
            raise BridgeError("Conflicting or expired PCM retry")
        if seq >= self.next_seq + self.WINDOW:
            raise BridgeError("PCM receive window exceeded")
        if seq in self.pending:
            raise BridgeError("PCM chunk already in flight")
        else:
            if self.accepted_bytes + len(pcm) > self.MAX_TURN_BYTES:
                raise BridgeError("PCM turn exceeds duration limit")
            ack = asyncio.get_running_loop().create_future()
            # A timed-out RPC may no longer await this acknowledgement.
            ack.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
            chunk = Chunk(pcm, digest, ack)
            self.pending[seq] = chunk
            self.accepted_bytes += len(pcm)
        if self.next_seq in self.pending and (self.worker is None or self.worker.done()):
            self.worker = asyncio.create_task(self._drain(self.generation))
        generation = self.generation
        done, _ = await asyncio.wait([chunk.ack], timeout=self.ack_timeout)
        if not done:
            if generation == self.generation:
                await self.cancel()
            raise BridgeError("PCM acknowledgement timed out") from None
        return chunk.ack.result()

    async def _write(self, pcm: bytes):
        if self.started is None:
            self.started = self.clock()
        due = self.started + max(0, (self.forwarded_bytes + len(pcm)) /
                                 self.BYTES_PER_SECOND - self.LOOKAHEAD_SECONDS)
        delay = due - self.clock()
        if delay > 0:
            await self.sleep(delay)
        await asyncio.wait_for(self.sink.write(pcm), self.operation_timeout)
        self.forwarded_bytes += len(pcm)

    async def _drain(self, generation):
        try:
            while self.phase == "open" and self.generation == generation:
                seq = self.next_seq
                chunk = self.pending.get(seq)
                if chunk is None:
                    return
                await self._write(chunk.data)
                self.pending.pop(seq)
                self.next_seq += 1
                result = {"seq": seq, "forwarded_samples": self.forwarded_bytes // 2}
                self.recent[seq] = (chunk.digest, result)
                while len(self.recent) > self.WINDOW:
                    self.recent.pop(min(self.recent))
                if not chunk.ack.done():
                    chunk.ack.set_result(result)
        except asyncio.CancelledError:
            raise
        except Exception:
            self.phase = "closed"
            self._reject_pending("PCM sink failed; reconnect required")
            # Closing must fence partially forwarded audio too.
            try:
                await asyncio.wait_for(self.sink.clear(), self.operation_timeout)
            except Exception:
                pass

    def _reject_pending(self, reason):
        for chunk in self.pending.values():
            if not chunk.ack.done():
                chunk.ack.set_exception(BridgeError(reason))
        self.pending.clear()

    async def end(self, count):
        if type(count) is not int or count < 0 or count != self.next_seq or self.pending:
            raise BridgeError("PCM end has missing chunks")
        if self.phase == "sealed":
            return {"sealed": True, "forwarded_samples": self.forwarded_bytes // 2}
        if self.phase != "open":
            raise BridgeError("PCM turn is not open")
        self.phase = "sealing"
        async def pad():
            # Do not close the avatar data stream or emit a room-ending marker.
            # Stage acceptance must verify this padding against resampling/tails.
            remaining = (-self.forwarded_bytes) % self.BATCH_BYTES
            while remaining:
                size = min(remaining, self.CHUNK_BYTES)
                await self._write(bytes(size))
                remaining -= size
            self.phase = "sealed"
        self.worker = asyncio.create_task(pad())
        try:
            await asyncio.shield(self.worker)
        except asyncio.CancelledError:
            raise BridgeError("PCM turn cancelled") from None
        except Exception:
            self.phase = "closed"
            try:
                await asyncio.wait_for(self.sink.clear(), self.operation_timeout)
            except Exception:
                pass
            raise BridgeError("PCM tail failed; reconnect required") from None
        return {"sealed": True, "forwarded_samples": self.forwarded_bytes // 2}

    async def cancel(self):
        if self.reset_task and not self.reset_task.done():
            await asyncio.shield(self.reset_task)
            return
        was_closed = self.phase == "closed"
        self.phase = "clearing"
        async def reset():
            if self.worker and not self.worker.done():
                self.worker.cancel()
                await asyncio.gather(self.worker, return_exceptions=True)
            self._reject_pending("PCM turn cancelled")
            try:
                await asyncio.wait_for(self.sink.clear(), self.operation_timeout)
            except Exception:
                self.phase = "closed"
                raise BridgeError("PCM cancellation failed; reconnect required") from None
            self.phase = "closed" if was_closed else "idle"
            self.generation = None
        self.reset_task = asyncio.create_task(reset())
        await asyncio.shield(self.reset_task)

    async def close(self):
        self.closing = True
        try:
            await self.cancel()
        finally:
            self.phase = "closed"
