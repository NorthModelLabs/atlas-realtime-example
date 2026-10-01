"""Run with the pinned LiveKit SDK, using synthetic tones and no network."""
import array
import asyncio
import json
import math
import struct
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from livekit import rtc
from pcm_frames import PcmFrames


def tone(samples, frequency=440):
    return b''.join(struct.pack('<h',round(4000*math.sin(2*math.pi*frequency*i/24000))) for i in range(samples))


class NativeSink:
    def __init__(self): self.frames=[]; self.ends=0; self.clears=0
    async def write(self,data): self.frames.append(data)
    async def end(self): self.ends+=1
    async def clear(self): self.frames.clear(); self.clears+=1


class FrameTests(unittest.IsolatedAsyncioTestCase):
    def assert_pcm_equivalent(self,actual,expected):
        self.assertEqual(len(actual),len(expected))
        a=array.array('h',actual);b=array.array('h',expected)
        peak=max((abs(x-y) for x,y in zip(a,b)),default=0)
        print('FRAME_PRECISION '+json.dumps({'samples':len(a),'max_lsb_difference':peak}),flush=True)
        # Independent native resamplers quantize with tiny sample differences.
        # Keep sample counts/order strict and allow at most two PCM16 LSBs.
        self.assertLessEqual(peak,2)

    async def convert(self,pcm,widths=(128,9600,482,7200)):
        sink=NativeSink();framer=PcmFrames(sink);offset=0;i=0
        while offset<len(pcm):
            size=widths[i%len(widths)];i+=1
            await framer.write(pcm[offset:offset+size]);offset+=size
            self.assertLess(len(framer.pending),1280)
        await framer.end()
        self.assertEqual(sink.ends,1)
        self.assertTrue(all(len(x)==1280 for x in sink.frames))
        return sink,framer

    async def test_partial_tails_preserve_reference_resampling_and_bounded_padding(self):
        for samples in [24,240,936,960,984,2952,9600,48312]:
            with self.subTest(input_samples=samples):
                pcm=tone(samples)
                sink,framer=await self.convert(pcm)
                data=b''.join(sink.frames)
                reference=rtc.AudioResampler(input_rate=24000,output_rate=16000,num_channels=1)
                frames=reference.push(rtc.AudioFrame(data=pcm,sample_rate=24000,num_channels=1,samples_per_channel=samples))
                frames+=reference.flush()
                expected=b''.join(bytes(frame.data) for frame in frames)
                self.assertEqual(len(expected)//2,samples*2//3)
                self.assertEqual(len(data),math.ceil(len(expected)/1280)*1280)
                self.assert_pcm_equivalent(data[:len(expected)],expected)
                self.assertEqual(data[len(expected):],bytes(len(data)-len(expected)))
                self.assertIsNone(framer.resampler)
                self.assertFalse(framer.pending)

    async def test_clear_resets_filter_history_before_replacement(self):
        sink=NativeSink();framer=PcmFrames(sink)
        await framer.write(tone(240,880))
        await framer.clear()
        replacement=tone(2952,330)
        await framer.write(replacement);await framer.end()
        fresh,_=await self.convert(replacement)
        self.assert_pcm_equivalent(b''.join(sink.frames),b''.join(fresh.frames))
        self.assertEqual(sink.clears,1)

    async def test_finished_turn_requires_clear_before_new_input(self):
        sink,framer=await self.convert(tone(240))
        await framer.end();self.assertEqual(sink.ends,1)
        with self.assertRaises(ValueError):await framer.write(tone(240))
        await framer.clear();await framer.write(tone(240,660));await framer.end()
        fresh,_=await self.convert(tone(240,660))
        self.assert_pcm_equivalent(b''.join(sink.frames),b''.join(fresh.frames))

    async def test_empty_end_and_malformed_input_do_not_invent_audio(self):
        sink=NativeSink();framer=PcmFrames(sink)
        for pcm in [b'',b'\x00',bytes(9602)]:
            with self.assertRaises(ValueError):await framer.write(pcm)
        self.assertFalse(sink.frames)
        await framer.end();self.assertFalse(sink.frames);self.assertEqual(sink.ends,1)


if __name__=='__main__': unittest.main(verbosity=2)
