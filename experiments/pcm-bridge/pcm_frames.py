"""Experimental per-turn 24→16-kHz conversion; never imported by production.

The downstream sink accepts 40-ms PCM16 mono frames at 16 kHz. It must provide
an explicit segment end and a verified receiver-side clear barrier. Flush the
resampler before ending; do not carry filter delay into the next response.
"""
from typing import Protocol


class NativeSink(Protocol):
    async def write(self, pcm: bytes) -> None: ...
    async def end(self) -> None: ...
    async def clear(self) -> None: ...


class PcmFrames:
    FRAME_BYTES = 640 * 2
    INPUT_RATE = 24000
    OUTPUT_RATE = 16000

    def __init__(self, destination: NativeSink):
        from livekit import rtc
        self.rtc = rtc
        self.destination = destination
        self.resampler = None
        self.pending = bytearray()
        self.ended = False

    async def _append(self, frames):
        for frame in frames:
            self.pending.extend(bytes(frame.data))
            while len(self.pending) >= self.FRAME_BYTES:
                data = bytes(self.pending[:self.FRAME_BYTES])
                del self.pending[:self.FRAME_BYTES]
                await self.destination.write(data)

    async def write(self, pcm: bytes):
        if self.ended:
            raise ValueError('PCM segment already ended')
        if not pcm or len(pcm) % 2 or len(pcm) > 9600:
            raise ValueError('Invalid bounded PCM16 input')
        if self.resampler is None:
            self.resampler = self.rtc.AudioResampler(
                input_rate=self.INPUT_RATE, output_rate=self.OUTPUT_RATE, num_channels=1)
        frame = self.rtc.AudioFrame(data=pcm, sample_rate=self.INPUT_RATE,
                                   num_channels=1, samples_per_channel=len(pcm)//2)
        await self._append(self.resampler.push(frame))

    async def end(self):
        if self.ended:
            return
        self.ended = True
        if self.resampler is not None:
            await self._append(self.resampler.flush())
            self.resampler = None
        if self.pending:
            # Pad only the final partial video frame (<40 ms), never a whole
            # model batch. The real tail and padding travel in the same frame.
            data = bytes(self.pending) + bytes(self.FRAME_BYTES-len(self.pending))
            self.pending.clear()
            await self.destination.write(data)
        await self.destination.end()

    async def clear(self):
        # The parent bridge cancels any writer before calling this barrier.
        self.pending.clear()
        self.resampler = None
        await self.destination.clear()
        self.ended = False
