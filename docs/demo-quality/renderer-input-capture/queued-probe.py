import asyncio,base64,contextlib,hashlib,json,logging,os,sys,time
from pathlib import Path
import numpy as np
import cv2
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path[:0]=['/workspace','/probe']
import avatar_runner as r
from renderer_input_capture import RendererInputCapture
logging.disable(logging.CRITICAL)
EXPECTED='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()==EXPECTED

def envelope(raw,rate=16000):
 x=np.frombuffer(raw,dtype='<i2').astype(float); n=round(rate*.04)
 return [round(float(np.sqrt(np.mean(x[i:i+n]**2))),5) for i in range(0,len(x),n) if len(x[i:i+n])]

def emit_frame(vf,trial,index,offset,rms):
 assert vf.type==r.rtc.VideoBufferType.RGBA
 image=np.frombuffer(bytes(vf.data),np.uint8).reshape(vf.height,vf.width,4)[:,:,:3]
 image=cv2.resize(image,(256,256),interpolation=cv2.INTER_AREA)
 ok,jpeg=cv2.imencode('.jpg',cv2.cvtColor(image,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,65]);assert ok
 encoded=base64.b64encode(jpeg.tobytes()).decode();parts=[encoded[i:i+1000] for i in range(0,len(encoded),1000)]
 row={'condition':'baseline','trial':trial,'audio_frame':index,'after_last_voiced_frame_ms':offset,'paired_audio_rms':rms,'parts':len(parts),'jpeg_sha256':hashlib.sha256(jpeg.tobytes()).hexdigest()}
 print('TAIL_MODEL_FRAME '+json.dumps(row),flush=True)
 for j,part in enumerate(parts):print('TAIL_MODEL_CHUNK '+json.dumps({'condition':'baseline','trial':trial,'audio_frame':index,'part':j,'data':part}),flush=True)

async def trial_run(trial,noise):
 raw=Path('/probe/question.pcm').read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='962289ba66028ad5b6de2b50b0f9152b16f2ba83c3b88e970aec006910b48b0b'
 speech=np.frombuffer(raw,dtype='<i2')
 # Public synthetic speech, preserving its samples and 24k sample rate.
 bins=envelope(raw,24000);last=max(i for i,v in enumerate(bins) if v>32)
 speech=speech[:(last+1)*960]
 tail=np.random.default_rng(71).choice([-noise,noise],size=24000*2).astype('<i2')
 pcm=np.concatenate([np.zeros(24000,dtype='<i2'),speech,tail,np.zeros(24000*4,dtype='<i2')]).astype('<i2').tobytes()
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=512,video_height=512,video_fps=25,audio_sample_rate=16000,audio_channels=1),service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
 for _ in range(4):
  await gen.warmup(batches=1)
  while not gen._render_queue.empty():gen._render_queue.get_nowait()
 directory=Path('/tmp/capture-'+str(trial));capture=RendererInputCapture(gen,Path('/workspace/avatar_runner.py'),directory,max_calls=64)
 rows=[];frames=[];pipeline=None
 async def produce():
  start=time.monotonic()
  for offset in range(0,len(pcm),960):
   data=pcm[offset:offset+960]
   await gen.push_audio(r.rtc.AudioFrame(data=data,sample_rate=24000,num_channels=1,samples_per_channel=len(data)//2))
   await asyncio.sleep(max(0,start+(offset+len(data))/48000-time.monotonic()))
 async def consume():
  while True:
   item=await gen._render_queue.get()
   if not isinstance(item,tuple):continue
   vf,af=item
   if af is not None:
    audio=bytes(af.data);rms=envelope(audio,af.sample_rate)
    rows.append({'index':len(rows),'rms':max(rms) if rms else 0,'samples':af.samples_per_channel,'sha256':hashlib.sha256(audio).hexdigest()})
    frames.append(vf)
   await asyncio.sleep(.04)
 try:
  async with r.httpx.AsyncClient(timeout=r.httpx.Timeout(120)) as client:
   gen._http_client=client
   pipeline=asyncio.create_task(gen._inference_loop());consumer=asyncio.create_task(consume())
   try:
    await produce();await asyncio.sleep(8)
    if pipeline.done():pipeline.result()
   finally:
    pipeline.cancel();consumer.cancel()
    await asyncio.gather(pipeline,consumer,return_exceptions=True)
 finally:capture.close()
 manifest=json.loads((directory/'manifest.json').read_text());assert manifest['disabled_reason'] is None
 captured=[]
 for file in sorted(directory.glob('[0-9][0-9][0-9][0-9].json')):
  entry=json.loads(file.read_text());data=(directory/entry['model_input_file']).read_bytes();entry['input_rms_40ms']=envelope(data)
  if entry['paired_audio']:
   paired=(directory/entry['paired_audio']['file']).read_bytes();entry['paired_rms_40ms']=envelope(paired)
  captured.append(entry)
 assert rows and captured
 end=max(i for i,x in enumerate(rows) if x['rms']>32)
 selected={end+x for x in [-4,0,5,10,20,32,50,75] if 0<=end+x<len(rows)}
 for i in sorted(selected):emit_frame(frames[i],trial,i,(i-end)*40,rows[i]['rms'])
 result={'condition':'baseline','trial':trial,'noise_level_pcm16':noise,'input_sample_rate':24000,'input_samples':len(pcm)//2,'last_voiced_output_frame':end,'paired_frames':len(rows),'output_audio_rms_40ms':[x['rms'] for x in rows],'output_audio_frame_hashes_sha256':hashlib.sha256(''.join(x['sha256'] for x in rows).encode()).hexdigest(),'capture_manifest':manifest,'renderer_inputs':captured,'selected_frames':len(selected),'scope':'Exact runner push_audio, resampling, inference queue, normalization and original model; synthetic input, no LiveKit codec or provider transport'}
 print('TAIL_MODEL_RESULT '+json.dumps(result),flush=True)

async def main():
 for trial,noise in enumerate([0,6,0]):await trial_run(trial,noise)
 print('TAIL_MODEL_COMPLETE '+json.dumps({'condition':'baseline','passed':True,'trials':3}),flush=True)
asyncio.run(asyncio.wait_for(main(),480))
