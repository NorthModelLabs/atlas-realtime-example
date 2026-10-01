import asyncio, contextlib, hashlib, inspect, json, logging, os, sys, time
from pathlib import Path
os.environ.update(AVATAR_VIDEO_FPS='25', AVATAR_AUDIO_QUEUE_MAX_FRAMES='32', AVATAR_SPEECH_PREFETCH_ENABLED='true', AVATAR_SILENCE_GATE_ENABLED='false')
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)

async def run(segment,gate,prefetch,tail,leading,trial):
 r._SEGMENT_LIFECYCLE_ENABLED=segment;r._SILENCE_GATE_ENABLED=gate;r._SPEECH_PREFETCH_ENABLED=prefetch;r._SILENCE_TAIL_FLUSH_ENABLED=tail
 options=r.AvatarOptions(video_width=64,video_height=64,video_fps=25,audio_sample_rate=16000,audio_channels=1)
 gen=r.AvatarVideoGenerator(options,image_path='/probe/face.jpg',service_url='http://127.0.0.1:1')
 calls=[]; start=time.monotonic();speech_at=None
 async def stream(pcm,generation,audio_chunks=None):
  frames=audio_chunks or []
  voiced=sum(r.AvatarVideoGenerator._frame_rms(f)>200 for f in frames)
  calls.append({'at_ms':round((time.monotonic()-start)*1000,1),'frames':len(frames),'voiced':voiced})
  return len(frames)
 async def idle(*args,**kw):return None
 gen._run_inference_streaming=stream;gen._submit_idle_inference=idle
 task=asyncio.create_task(gen._inference_loop())
 try:
  for i in range(leading+80):
   await asyncio.sleep(max(0,start+i*.04-time.monotonic()))
   speaking=leading<=i<leading+50
   if i==leading:speech_at=(time.monotonic()-start)*1000
   frame=r.rtc.AudioFrame(data=(b'\xe8\x03' if speaking else b'\0\0')*640,sample_rate=16000,num_channels=1,samples_per_channel=640)
   result=gen.push_audio(frame)
   if inspect.isawaitable(result):await result
   if task.done():await task
  await asyncio.sleep(.1)
 finally:
  task.cancel()
  with contextlib.suppress(asyncio.CancelledError):await task
 first=next((x for x in calls if x['voiced']),None)
 return {'segment':segment,'silence_gate':gate,'prefetch':prefetch,'tail_flush':tail,'leading_silence_frames':leading,'trial':trial,'input_voiced_frames':50,'submitted_voiced_frames':sum(x['voiced'] for x in calls),'speech_to_first_submission_ms':round(first['at_ms']-speech_at,1) if first else None,'first_speech_batch_frames':first['frames'] if first else None,'calls':calls}
async def main():
 for settings in [(False,False,True,False),(True,True,True,False),(True,True,True,True)]:
  for leading in [0,8,20]:
   for trial in range(2):
    print('RUNNER_BATCH '+json.dumps(await run(*settings,leading,trial)),flush=True)
 print('RUNNER_BATCH_COMPLETE '+json.dumps({'source_verified':True,'gpu_calls':0,'network':'disabled','limits':'CPU-only input admission test; inference mocked immediate; not E2E or rendering acceptance'}),flush=True)
asyncio.run(main())
