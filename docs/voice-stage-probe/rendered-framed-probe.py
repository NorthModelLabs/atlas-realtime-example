import asyncio, contextlib, hashlib, hmac, base64, importlib.metadata, inspect, json, logging, math, os, struct, sys, time
from pathlib import Path
from contextlib import asynccontextmanager
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
from livekit import rtc
from pcm_frames import PcmFrames
from livekit.agents.voice.avatar import AvatarRunner, DataStreamAudioOutput, DataStreamAudioReceiver
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
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

def token(identity):
    def enc(value): return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    body=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'iss':'devkey','sub':identity,'exp':int(time.time())+300,'nbf':int(time.time())-10,'video':{'roomJoin':True,'room':'isolated-pcm','canPublish':True,'canSubscribe':True,'canPublishData':True}})
    return (body+b'.'+base64.urlsafe_b64encode(hmac.new(b'secret',body,hashlib.sha256).digest()).rstrip(b'=')).decode()

async def main():
    rooms=[]; readers=[]; read_tasks=[]; runner=None; gen=None
    capture={'audio_frames':0,'video_frames':0,'audio_nonzero':0}; pre_encode=[]; results=[]
    try:
        for identity in ['bridge-agent','avatar-owned','observer-owned']:
            room=rtc.Room(); rooms.append(room)
            if identity=='observer-owned':
                @room.on('track_subscribed')
                def subscribed(track,publication,participant):
                    if participant.identity!='avatar-owned': return
                    async def read():
                        stream=rtc.AudioStream(track,sample_rate=16000,num_channels=1) if track.kind==rtc.TrackKind.KIND_AUDIO else rtc.VideoStream(track)
                        readers.append(stream)
                        async for event in stream:
                            if track.kind==rtc.TrackKind.KIND_AUDIO:
                                capture['audio_frames']+=1
                                if r.AvatarVideoGenerator._frame_rms(event.frame)>200: capture['audio_nonzero']+=1
                            else: capture['video_frames']+=1
                    read_tasks.append(asyncio.create_task(read()))
            await room.connect('ws://172.28.51.2:7880',token(identity))
        agent,avatar,observer=rooms
        opts=r.AvatarOptions(video_width=64,video_height=64,video_fps=25,audio_sample_rate=16000,audio_channels=1)
        gen=r.AvatarVideoGenerator(opts,service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
        for _ in range(4):
            await gen.warmup(batches=1)
            while not gen._render_queue.empty():gen._render_queue.get_nowait()
        receiver=DataStreamAudioReceiver(avatar,sender_identity='bridge-agent',frame_size_ms=40)
        runner=AvatarRunner(avatar,audio_recv=receiver,video_gen=gen,options=opts)
        original_push=runner.av_sync.push
        async def measured_push(frame,*args,**kwargs):
            if isinstance(frame,rtc.AudioFrame) and r.AvatarVideoGenerator._frame_rms(frame)>200:
                pre_encode.append({'time':time.monotonic(),'samples':frame.samples_per_channel,'rate':frame.sample_rate})
            return await original_push(frame,*args,**kwargs)
        runner.av_sync.push=measured_push
        await runner.start()
        output=DataStreamAudioOutput(agent,destination_identity='avatar-owned',sample_rate=16000)
        # Subscribe and settle idle publication separately from speech onset.
        deadline=time.monotonic()+15
        while capture['video_frames']<5:
            if time.monotonic()>deadline:raise TimeoutError('rendered tracks did not start')
            await asyncio.sleep(.05)
        for number,(mode,duration) in enumerate([('ahead',.01),('ahead',.4),('paced',2.0),('ahead',2.0),('ahead',2.0)]):
            await asyncio.sleep(.3)
            rate=24000;samples=round(rate*duration)
            pcm=b''.join(struct.pack('<h',round(4000*math.sin(2*math.pi*(440+number*100)*i/rate))) for i in range(samples))
            class NativeSink:
                async def write(self, data):
                    await output.capture_frame(rtc.AudioFrame(data=data,sample_rate=16000,num_channels=1,samples_per_channel=len(data)//2))
                async def end(self): output.flush()
                async def clear(self): raise AssertionError('clear barrier not part of this test')
            framed=PcmFrames(NativeSink())
            before=len(pre_encode);before_remote=dict(capture);at=time.monotonic()
            for offset in range(0,len(pcm),4800):
                end=min(len(pcm),offset+4800)
                due=(offset/48000 if mode=='paced' else max(0,end/48000-1.28))
                await asyncio.sleep(max(0,at+due-time.monotonic()))
                chunk=pcm[offset:end]
                await framed.write(chunk)
            await framed.end()
            playback=await asyncio.wait_for(output.wait_for_playout(),20)
            # Let already-published packets reach the observer without adding model work.
            await asyncio.sleep(.25)
            got=pre_encode[before:];count=sum(x['samples'] for x in got)
            row={'case':number,'mode':mode,'input_ms':duration*1000,'voiced_samples_16khz':count,
                 'duration_within_one_frame':count>0 and abs(count/16000-duration)<=.0401,
                 'input_to_first_pre_encode_ms':round((got[0]['time']-at)*1000,1) if got else None,
                 'max_pre_encode_gap_ms':round(max([b['time']-a['time'] for a,b in zip(got,got[1:])] or [0])*1000,1),
                 'remote_audio_frames':capture['audio_frames']-before_remote['audio_frames'],
                 'remote_nonzero_frames':capture['audio_nonzero']-before_remote['audio_nonzero'],
                 'remote_video_frames':capture['video_frames']-before_remote['video_frames'],
                 'rooms_connected':all(x.isconnected() for x in rooms)}
            results.append(row);print('RENDERED_RESULT '+json.dumps(row),flush=True)
        print('RENDERED_COMPLETE '+json.dumps({'cases':len(results),'duration_checks_passed':all(x['duration_within_one_frame'] for x in results),'actual_media_received':all(x['remote_nonzero_frames']>0 and x['remote_video_frames']>0 for x in results),'per_turn_resampling':True,'scope':'pinned runner and SDK, 24-to-16kHz resampling and real WebRTC media; simulated model, private local network, no browser/provider/production'}),flush=True)
    finally:
        if runner:await runner.aclose()
        for task in read_tasks:task.cancel()
        await asyncio.gather(*read_tasks,return_exceptions=True)
        await asyncio.gather(*(s.aclose() for s in readers),return_exceptions=True)
        await asyncio.gather(*(room.disconnect() for room in rooms),return_exceptions=True)

asyncio.run(asyncio.wait_for(main(),180))
