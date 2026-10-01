import asyncio, contextlib, hashlib, importlib.metadata, inspect, json, logging, os, struct, sys, time
from pathlib import Path
from contextlib import asynccontextmanager
os.environ.update(AVATAR_VIDEO_FPS='25', AVATAR_AUDIO_QUEUE_MAX_FRAMES='32', AVATAR_SPEECH_PREFETCH_ENABLED='true', AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0, '/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest() == '55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)

class Response:
    headers = {'content-type': 'application/x-avatar-stream'}
    def raise_for_status(self): pass
    async def aiter_bytes(self):
        await asyncio.sleep(.4)
        for i in range(32):
            if i: await asyncio.sleep(.029)
            record = b'\1' + struct.pack('>IHHB', i, 64, 64, 3) + bytes([i]) * 64 * 64 * 3
            yield struct.pack('>I', len(record)) + record
        record = b'\2' + struct.pack('>I', 32)
        yield struct.pack('>I', len(record)) + record

class Client:
    def __init__(self, *args, **kwargs): pass
    async def aclose(self): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    @asynccontextmanager
    async def stream(self, *args, **kwargs): yield Response()

r.httpx.AsyncClient = Client

async def submit(gen, value):
    result = gen.push_audio(value)
    if inspect.isawaitable(result): await result

def frame(value):
    return r.rtc.AudioFrame(data=struct.pack('<h', value) * 640,
                           sample_rate=16000, num_channels=1, samples_per_channel=640)

async def main():
    versions = {name: importlib.metadata.version(name) for name in ['livekit', 'livekit-agents']}
    print('SEGMENT_METADATA ' + json.dumps({'versions': versions, 'segment_lifecycle': r._SEGMENT_LIFECYCLE_ENABLED,
          'silence_gate': r._SILENCE_GATE_ENABLED, 'tail_flush': r._SILENCE_TAIL_FLUSH_ENABLED}), flush=True)
    gen = r.AvatarVideoGenerator(r.AvatarOptions(video_width=512, video_height=512, video_fps=25,
                                 audio_sample_rate=16000, audio_channels=1),
                                 service_url='http://127.0.0.1:8000', image_path='/probe/face.jpg')
    for _ in range(4):
        await gen.warmup(batches=1)
        while not gen._render_queue.empty(): gen._render_queue.get_nowait()
    outputs, markers, calls = [], [], []
    start = time.monotonic()
    original = gen._run_inference_streaming
    async def inference(pcm, generation, audio_chunks=None):
        at = time.monotonic()
        result = await original(pcm, generation, audio_chunks=audio_chunks)
        calls.append({'requested_frames': len(audio_chunks) if audio_chunks is not None else None,
                      'output_frames': result, 'duration_ms': round((time.monotonic()-at)*1000, 1)})
        return result
    gen._run_inference_streaming = inference
    iterator = gen.__aiter__()
    async def consume():
        due = time.monotonic()
        async for item in iterator:
            if isinstance(item, r.rtc.VideoFrame):
                due = max(due + .04, time.monotonic())
                await asyncio.sleep(max(0, due-time.monotonic()))
            elif isinstance(item, r.rtc.AudioFrame):
                pcm = bytes(item.data)
                if r.AvatarVideoGenerator._frame_rms(item) > 200:
                    outputs.append({'id': struct.unpack('<h', pcm[:2])[0], 'samples': len(pcm)//2,
                                    'constant': pcm == pcm[:2]*(len(pcm)//2),
                                    'ms': round((time.monotonic()-start)*1000, 1)})
            elif isinstance(item, r.AudioSegmentEnd):
                markers.append({'ms': round((time.monotonic()-start)*1000, 1), 'outputs': len(outputs)})
    task = asyncio.create_task(consume())
    async def wait_for(predicate, timeout=15):
        end = time.monotonic()+timeout
        while not predicate():
            if task.done(): await task; raise RuntimeError('iterator ended')
            if time.monotonic()>end: raise TimeoutError('segment did not complete')
            await asyncio.sleep(.01)
    results = []
    try:
        for number, count in enumerate([10, 50, 100]):
            await asyncio.sleep(.8)
            base = (number+1)*1000
            before, before_marker, before_call = len(outputs), len(markers), len(calls)
            at = time.monotonic()
            for i in range(count): await submit(gen, frame(base+i))
            await submit(gen, r.AudioSegmentEnd())
            await wait_for(lambda: len(markers)>before_marker)
            got = outputs[before:]
            row = {'case': 'natural_end', 'frames': count, 'speech_preserved': [x['id'] for x in got] == list(range(base,base+count)) and all(x['constant'] and x['samples']==640 for x in got),
                   'returned_frames': len(got), 'markers': len(markers)-before_marker,
                   'iterator_alive': not task.done(), 'elapsed_ms': round((time.monotonic()-at)*1000,1), 'calls': calls[before_call:]}
            results.append(row); print('SEGMENT_RESULT '+json.dumps(row),flush=True)
        old_start = len(outputs)
        async def interrupted():
            for i in range(100): await submit(gen, frame(4000+i))
        producer = asyncio.create_task(interrupted())
        await wait_for(lambda: len(outputs)>=old_start+2)
        producer.cancel(); await asyncio.gather(producer, return_exceptions=True)
        cleared = gen.clear_buffer()
        if inspect.isawaitable(cleared): await cleared
        before_marker = len(markers)
        for i in range(10): await submit(gen, frame(5000+i))
        await submit(gen,r.AudioSegmentEnd())
        await wait_for(lambda: len(markers)>before_marker)
        after = outputs[old_start:]
        new_index = next((i for i,x in enumerate(after) if x['id']>=5000),None)
        replacement = after[new_index:] if new_index is not None else []
        row = {'case':'interruption','replacement_preserved': [x['id'] for x in replacement]==list(range(5000,5010)),
               'no_old_audio_after_replacement': new_index is not None and all(x['id']>=5000 for x in replacement),
               'iterator_alive':not task.done(),'returned_ids':[x['id'] for x in after]}
        results.append(row);print('SEGMENT_RESULT '+json.dumps(row),flush=True)
    except Exception as error:
        print('SEGMENT_ERROR '+json.dumps({'type':type(error).__name__,'message':str(error),'outputs':len(outputs),'markers':len(markers)}),flush=True)
    finally:
        task.cancel(); await asyncio.gather(task,return_exceptions=True)
        await iterator.aclose()
    print('SEGMENT_COMPLETE '+json.dumps({'cases':len(results),'source_verified':True,'scope':'exact runner and SDK; simulated model; no LiveKit network/AvatarRunner media publishing'}),flush=True)

asyncio.run(asyncio.wait_for(main(),180))
