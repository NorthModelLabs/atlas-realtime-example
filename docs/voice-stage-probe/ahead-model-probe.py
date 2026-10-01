import asyncio, hashlib, inspect, json, logging, os, struct, sys, time
from pathlib import Path
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
assert not r._SEGMENT_LIFECYCLE_ENABLED and not r._SILENCE_TAIL_FLUSH_ENABLED
logging.disable(logging.CRITICAL)

async def main():
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=512,video_height=512,video_fps=25,audio_sample_rate=16000,audio_channels=1),service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
 warm=[]
 for i in range(4):
  at=time.monotonic();n=await gen.warmup(batches=1);warm.append({'frames':n,'ms':round((time.monotonic()-at)*1000,1)})
  while not gen._render_queue.empty():gen._render_queue.get_nowait()
 print('AHEAD_MODEL_WARMUPS '+json.dumps(warm),flush=True)
 outputs=[];markers=asyncio.Queue();iterator=gen.__aiter__();calls=[]
 original=gen._run_inference_streaming
 async def inference(pcm,generation,audio_chunks=None):
  at=time.monotonic();result=await original(pcm,generation,audio_chunks=audio_chunks)
  calls.append({'frames':result,'requested_frames':len(audio_chunks) if audio_chunks is not None else None,'ms':round((time.monotonic()-at)*1000,1)})
  return result
 gen._run_inference_streaming=inference
 async def consume():
  due=time.monotonic()
  async for item in iterator:
   if isinstance(item,r.rtc.VideoFrame):
    due=max(due+.04,time.monotonic());await asyncio.sleep(max(0,due-time.monotonic()))
   elif isinstance(item,r.rtc.AudioFrame) and r.AvatarVideoGenerator._frame_rms(item)>200:
    pcm=bytes(item.data);outputs.append({'id':struct.unpack('<h',pcm[:2])[0],'samples':len(pcm)//2,'constant':pcm==pcm[:2]*(len(pcm)//2),'time':time.monotonic()})
   elif isinstance(item,r.AudioSegmentEnd):await markers.put(len(outputs))
 task=asyncio.create_task(consume());results=[]
 try:
  for number,mode in enumerate(['paced','ahead','ahead','paced']):
   await asyncio.sleep(.8)
   before=len(outputs);before_calls=len(calls);start=time.monotonic();base=(number+1)*1000;count=100
   for i in range(count):
    due=(i*.04 if mode=='paced' else max(0,(i+1)*.04-1.28))
    await asyncio.sleep(max(0,start+due-time.monotonic()))
    value=gen.push_audio(r.rtc.AudioFrame(data=struct.pack('<h',base+i)*640,sample_rate=16000,num_channels=1,samples_per_channel=640))
    if inspect.isawaitable(value):await value
   value=gen.push_audio(r.AudioSegmentEnd())
   if inspect.isawaitable(value):await value
   await asyncio.wait_for(markers.get(),40)
   got=outputs[before:];ids=[x['id'] for x in got]
   result={'mode':mode,'trial':number,'first_audio_ms':round((got[0]['time']-start)*1000,1) if got else None,'max_gap_ms':round(max([b['time']-a['time'] for a,b in zip(got,got[1:])] or [0])*1000,1),'frames':len(got),'ordered_exact_pcm':ids==list(range(base,base+count)) and all(x['samples']==640 and x['constant'] for x in got),'inference_calls':calls[before_calls:]}
   results.append(result);print('AHEAD_MODEL_RESULT '+json.dumps(result),flush=True)
  assert len(results)==4 and all(x['ordered_exact_pcm'] for x in results)
  print('AHEAD_MODEL_COMPLETE '+json.dumps({'passed':True,'scope':'same isolated model and runner digests; synthetic PCM; paced 25fps consumer; no provider, browser or LiveKit network'}),flush=True)
 finally:
  task.cancel();await asyncio.gather(task,return_exceptions=True);await iterator.aclose()

asyncio.run(asyncio.wait_for(main(),480))
