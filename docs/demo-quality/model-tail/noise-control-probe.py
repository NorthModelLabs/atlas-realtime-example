import asyncio,base64,hashlib,io,json,logging,os,sys,wave
from pathlib import Path
import numpy as np
import cv2
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)
async def main():
 raw=Path('/probe/question.pcm').read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='962289ba66028ad5b6de2b50b0f9152b16f2ba83c3b88e970aec006910b48b0b'
 source=np.frombuffer(raw,dtype='<i2').astype(float)
 # Existing public spoken fixture is 24 kHz mono PCM16. Resample for runner input.
 resampled=np.interp(np.arange(0,len(source),1.5),np.arange(len(source)),source)
 speech=np.rint(resampled).astype('<i2').tobytes()
 speech+=bytes((-len(speech))%1280)
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=512,video_height=512,video_fps=25,audio_sample_rate=16000,audio_channels=1),service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
 for _ in range(4):
  await gen.warmup(batches=1)
  while not gen._render_queue.empty():gen._render_queue.get_nowait()
 async with r.httpx.AsyncClient(timeout=r.httpx.Timeout(120)) as client:
  gen._http_client=client
  speech_frames=[speech[i:i+1280] for i in range(0,len(speech),1280)]
  speech_rms=[float(np.sqrt(np.mean(np.frombuffer(x,dtype='<i2').astype(float)**2))) for x in speech_frames]
  speech=speech[:(max(i for i,x in enumerate(speech_rms) if x>32)+1)*1280]
  for trial,noise_level in enumerate([0,6,2,6]):
   leading=32
   signs=np.random.default_rng(71).choice([-1,1],size=32*640)
   tail=(signs*noise_level).astype('<i2').tobytes()+bytes(75*1280)
   pcm=bytes(leading*1280)+speech+tail
   pcm+=bytes((-len(pcm))%(32*1280))
   frames=[r.rtc.AudioFrame(data=pcm[i:i+1280],sample_rate=16000,num_channels=1,samples_per_channel=640) for i in range(0,len(pcm),1280)]
   rms=[float(np.sqrt(np.mean(np.frombuffer(bytes(f.data),dtype='<i2').astype(float)**2))) for f in frames]
   last=max(i for i,value in enumerate(rms) if value>32)
   selected={last+x for x in [0,2,5,10,15,20,25,32,40,50]}
   seen=[];audio_out=[];frame_count=0
   for offset in range(0,len(frames),32):
    chunk=frames[offset:offset+32];block=b''.join(bytes(f.data) for f in chunk)
    n=await gen._run_inference_streaming(gen._normalize_pcm(block),gen._generation,audio_chunks=chunk)
    assert n==32,(trial,offset,n)
    for index in range(32):
     vf,af=gen._render_queue.get_nowait();assert af is not None
     pos=offset+index;audio_out.append(bytes(af.data));frame_count+=1
     if pos in selected:
      assert vf.type==r.rtc.VideoBufferType.RGBA
      pixels=np.frombuffer(bytes(vf.data),dtype=np.uint8).reshape(vf.height,vf.width,4)[:,:,:3];pixels=cv2.resize(pixels,(256,256),interpolation=cv2.INTER_AREA);ok,jpeg=cv2.imencode('.jpg',cv2.cvtColor(pixels,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,60]);assert ok
      row={'trial':trial,'noise_level_pcm16':noise_level,'audio_frame':pos,'after_last_voiced_frame_ms':(pos-last)*40,'paired_audio_rms':round(rms[pos],3),'jpeg_b64':base64.b64encode(jpeg.tobytes()).decode()}
      print('TAIL_MODEL_FRAME '+json.dumps(row),flush=True);seen.append(pos)
   assert b''.join(audio_out)==pcm and set(seen)==selected
   print('TAIL_MODEL_RESULT '+json.dumps({'trial':trial,'noise_level_pcm16':noise_level,'leading_frames':leading,'frames':frame_count,'last_voiced_frame':last,'selected_frames':len(seen),'paired_audio_exact':True}),flush=True)
 print('TAIL_MODEL_COMPLETE '+json.dumps({'passed':True,'scope':'Exact model and runner digests; same spoken fixture followed by controlled low-level noise and then zeros; raw generated frames paired with exact input audio before LiveKit/browser; no playback pacing or latency benchmark'}),flush=True)
asyncio.run(asyncio.wait_for(main(),480))
