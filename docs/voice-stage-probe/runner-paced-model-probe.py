import asyncio, contextlib, hashlib, inspect, json, logging, os, struct, sys, time
from pathlib import Path
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)
async def trial(candidate,number):
 r._SEGMENT_LIFECYCLE_ENABLED=candidate;r._SILENCE_GATE_ENABLED=candidate;r._SPEECH_PREFETCH_ENABLED=True;r._SILENCE_TAIL_FLUSH_ENABLED=candidate
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=512,video_height=512,video_fps=25,audio_sample_rate=16000,audio_channels=1),service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
 # Complete four identical warmups per cache before measuring steady delivery.
 warm=[]
 for i in range(4):
  t=time.monotonic();n=await gen.warmup(batches=1);warm.append({'frames':n,'ms':round((time.monotonic()-t)*1000,1)})
  while not gen._render_queue.empty():gen._render_queue.get_nowait()
 calls=[];outputs=[];start=time.monotonic();speech_at=None;original=gen._run_inference_streaming
 async def inference(pcm,generation,audio_chunks=None):
  at=time.monotonic();row={'start_ms':round((at-start)*1000,1),'requested_frames':len(audio_chunks) if audio_chunks is not None else None}
  try:
   n=await original(pcm,generation,audio_chunks=audio_chunks);row['enqueued_frames']=n;return n
  finally:row['duration_ms']=round((time.monotonic()-at)*1000,1);calls.append(row)
 gen._run_inference_streaming=inference
 iterator=gen.__aiter__()
 async def consume():
  due=start
  async for item in iterator:
   if isinstance(item,r.rtc.VideoFrame):
    due=max(due+.04,time.monotonic());await asyncio.sleep(max(0,due-time.monotonic()))
   elif isinstance(item,r.rtc.AudioFrame):
    data=bytes(item.data)
    if r.AvatarVideoGenerator._frame_rms(item)>200:
     outputs.append({'at_ms':round((time.monotonic()-start)*1000,1),'id':struct.unpack('<h',data[:2])[0],'samples':len(data)//2,'constant':data==data[:2]*(len(data)//2)})
 task=asyncio.create_task(consume())
 try:
  for i in range(170):
   await asyncio.sleep(max(0,start+i*.04-time.monotonic()))
   voiced=20<=i<120
   if i==20:speech_at=(time.monotonic()-start)*1000
   value=1000+i-20 if voiced else 0
   submitted=gen.push_audio(r.rtc.AudioFrame(data=struct.pack('<h',value)*640,sample_rate=16000,num_channels=1,samples_per_channel=640))
   if inspect.isawaitable(submitted):await submitted
   if task.done():await task
  await asyncio.sleep(4)
 finally:
  task.cancel()
  with contextlib.suppress(asyncio.CancelledError):await task
  await iterator.aclose()
 expected=list(range(1000,1100));ids=[x['id'] for x in outputs]
 gaps=[round(b['at_ms']-a['at_ms'],1) for a,b in zip(outputs,outputs[1:]) if b['at_ms']-a['at_ms']>100]
 return {'candidate':candidate,'trial':number,'warmups':warm,'speech_to_first_audio_ms':round(outputs[0]['at_ms']-speech_at,1) if outputs else None,'voiced_frames_received':len(outputs),'ordered_samples_match':ids==expected and all(x['constant'] and x['samples']==640 for x in outputs),'missing_frame_ids':[i-1000 for i in expected if i not in ids],'duplicate_frames':len(ids)-len(set(ids)),'gaps_over_100ms':gaps,'outputs':outputs,'inference_calls':calls}
async def main():
 for number,candidate in enumerate([False,True,True,False]):
  try:result=await asyncio.wait_for(trial(candidate,number),120)
  except Exception as error:result={'candidate':candidate,'trial':number,'error_type':type(error).__name__}
  print('PREFETCH_MODEL_RESULT '+json.dumps(result),flush=True)
 print('PREFETCH_MODEL_COMPLETE '+json.dumps({'source_verified':True,'scope':'isolated exact model and runner; synthetic constant PCM frame identifiers; paced local consumer; no LiveKit/browser/provider'}),flush=True)
asyncio.run(main())
