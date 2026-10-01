import asyncio, hashlib, json, logging, os, struct, sys
from pathlib import Path
from contextlib import asynccontextmanager
os.environ['AVATAR_VIDEO_FPS']='25'
sys.path.insert(0,'/workspace')
import avatar_runner as r
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
logging.disable(logging.CRITICAL)
class Response:
 headers={'content-type':'application/x-avatar-stream'}
 def __init__(self):self.records=0;self.end_sent=False;self.closed=False
 def raise_for_status(self):pass
 async def aiter_bytes(self):
  for i in range(32):
   record=b'\1'+struct.pack('>IHHB',i,64,64,3)+bytes([i])*64*64*3
   packet=struct.pack('>I',len(record))+record
   self.records+=1
   for piece in [packet[:2],packet[2:11],packet[11:]]:yield piece
  self.end_sent=True
  record=b'\2'+struct.pack('>I',32)
  yield struct.pack('>I',len(record))+record
class Client:
 def __init__(self):self.response=Response();self.requested=None
 @asynccontextmanager
 async def stream(self,method,url,**kwargs):
  self.requested=int(kwargs['data']['max_frames'])
  try:yield self.response
  finally:self.response.closed=True
async def run(n):
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=64,video_height=64,video_fps=25,audio_sample_rate=16000,audio_channels=1),image_path='/probe/face.jpg')
 client=Client();gen._http_client=client
 inputs=[r.rtc.AudioFrame(data=struct.pack('<h',1000+i)*640,sample_rate=16000,num_channels=1,samples_per_channel=640) for i in range(n)]
 pcm=b''.join(bytes(f.data) for f in inputs)
 emitted=await gen._run_inference_streaming(gen._normalize_pcm(pcm),gen._generation,audio_chunks=inputs)
 outputs=[]
 while not gen._render_queue.empty():outputs.append(gen._render_queue.get_nowait())
 output_audio=b''.join(bytes(x[1].data) for x in outputs if isinstance(x,tuple) and x[1] is not None)
 assert emitted==n and len(outputs)==n and output_audio==pcm,(n,emitted,len(outputs),len(output_audio))
 print('RUNNER_DECODE '+json.dumps({'requested_frames':n,'enqueued_frames':emitted,'audio_samples_preserved_in_order':True,'mock_server_frame_records_read':client.response.records,'mock_end_record_reached':client.response.end_sent,'response_context_closed':client.response.closed}),flush=True)
async def main():
 for n in [8,16,18,32]:await asyncio.wait_for(run(n),10)
 print('RUNNER_DECODE_COMPLETE '+json.dumps({'source_verified':True,'gpu_calls':0,'network':'disabled','limitations':'Real stream decoder and frame pairing; synthetic server frames; no model cache, timing, transport or playback validation'}),flush=True)
asyncio.run(main())
