import asyncio, contextlib, hashlib, inspect, json, logging, os, struct, sys, time
from pathlib import Path
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)
async def trial(mode,number):
 candidate=False
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
  # Replay timing only, not provider speech. Each 40ms PCM block has a unique ID.
  schedule=json.loads(Path('/probe/provider-schedule.json').read_text())[2]['chunks']
  first=schedule[0]['after_request_ms']
  feed_ms=100 if mode=='ahead100' else 40
  total_samples=150*640
  pcm=b''.join(struct.pack('<h',1000+i if 0<=i<100 else 0)*640 for i in range(150))
  push_waits=[];max_queued_ms=0;max_behind_arrival_ms=0
  await asyncio.sleep(.8)
  for offset in range(0,total_samples,int(16000*feed_ms/1000)):
   frame_samples=min(int(16000*feed_ms/1000),total_samples-offset)
   audio_at_ms=offset/16
   if mode=='paced40' or audio_at_ms<0:
    due=audio_at_ms
   elif audio_at_ms<4000:
    speech_end=audio_at_ms+frame_samples/16
    due=next(c['after_request_ms']-first for c in schedule if c['cumulative_audio_ms']>=speech_end)
   else:
    # Continue trailing silence at real-time cadence from completion of speech submission.
    if audio_at_ms==4000:tail_start=(time.monotonic()-start)*1000
    due=tail_start+audio_at_ms-4000
   if audio_at_ms<4000:due+=800
   await asyncio.sleep(max(0,start+due/1000-time.monotonic()))
   if audio_at_ms==0:speech_at=(time.monotonic()-start)*1000
   before=time.monotonic()
   submitted=gen.push_audio(r.rtc.AudioFrame(data=pcm[offset*2:(offset+frame_samples)*2],sample_rate=16000,num_channels=1,samples_per_channel=frame_samples))
   if inspect.isawaitable(submitted):await submitted
   push_waits.append((time.monotonic()-before)*1000)
   max_queued_ms=max(max_queued_ms,gen._audio_queue_ms())
   if 0<=audio_at_ms<4000:max_behind_arrival_ms=max(max_behind_arrival_ms,(time.monotonic()-start)*1000-due)
   if task.done():await task
  await asyncio.sleep(4)
 finally:
  task.cancel()
  with contextlib.suppress(asyncio.CancelledError):await task
  await iterator.aclose()
 expected=list(range(1000,1100));ids=[x['id'] for x in outputs]
 gaps=[round(b['at_ms']-a['at_ms'],1) for a,b in zip(outputs,outputs[1:]) if b['at_ms']-a['at_ms']>100]
 return {'mode':mode,'trial':number,'max_input_queue_ms':max_queued_ms,'max_push_wait_ms':round(max(push_waits),1),'max_sender_behind_arrival_ms':round(max_behind_arrival_ms,1),'warmups':warm,'speech_to_first_audio_ms':round(outputs[0]['at_ms']-speech_at,1) if outputs else None,'voiced_frames_received':len(outputs),'ordered_samples_match':ids==expected and all(x['constant'] and x['samples']==640 for x in outputs),'missing_frame_ids':[i-1000 for i in expected if i not in ids],'duplicate_frames':len(ids)-len(set(ids)),'gaps_over_100ms':gaps,'outputs':outputs,'inference_calls':calls}
async def main():
 for number,mode in enumerate(['paced40','ahead100','ahead100','paced40']):
  try:result=await asyncio.wait_for(trial(mode,number),120)
  except Exception as error:result={'mode':mode,'trial':number,'error_type':type(error).__name__,'error':str(error)[:200]}
  print('AHEAD_IDLE_RESULT '+json.dumps(result),flush=True)
 print('AHEAD_IDLE_COMPLETE '+json.dumps({'source_verified':True,'scope':'exact runner with unchanged production flags; simulated model; measured provider timing replay; synthetic identifiable PCM; no LiveKit/browser or real model'}),flush=True)
asyncio.run(main())
