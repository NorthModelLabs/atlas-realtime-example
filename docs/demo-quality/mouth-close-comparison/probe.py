"""Isolated exact-PCM replay. No live ingress, transport, timing or playout claim."""
import asyncio,base64,hashlib,io,json,logging,os,sys,zipfile
from pathlib import Path
import numpy as np
import cv2
os.environ.update(AVATAR_VIDEO_FPS='25',AVATAR_AUDIO_QUEUE_MAX_FRAMES='32',AVATAR_SPEECH_PREFETCH_ENABLED='true',AVATAR_SILENCE_GATE_ENABLED='false')
sys.path[:0]=['/workspace','/probe']
import avatar_runner as r
RUNNER_SHA='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
assert hashlib.sha256(Path('/workspace/avatar_runner.py').read_bytes()).hexdigest()==RUNNER_SHA
logging.disable(logging.CRITICAL)
condition=os.environ['MOUTH_CONTROL_CONDITION'];assert condition in ('baseline','clamp','repeat')
EXPECTED=['26c3f4c421ffb3c12022e46e6e970fbff8bf04faf38f07e46cb4facda761c586','205fa644b0dafb306b310c425cbe99979409a77eb925f7fab3628828624e1eab']

def sha(data):return hashlib.sha256(data).hexdigest()
def emit(marker,data):
 line=marker+' '+json.dumps(data,separators=(',',':'));assert len(line)<512
 print(line,flush=True)

def make_archive(records,images):
 # Full-frame context remains 256px, crops remain64x48 at that same scale.
 # Reduce only JPEG quality if necessary; no frame dropping or silent ROI change.
 for quality in [60,55,50,45,40]:
  files={};rows=[]
  for meta,pixels in images:
   ok,jpeg=cv2.imencode('.jpg',cv2.cvtColor(pixels,cv2.COLOR_RGB2BGR),[cv2.IMWRITE_JPEG_QUALITY,quality,cv2.IMWRITE_JPEG_OPTIMIZE,1]);assert ok
   data=jpeg.tobytes();files[meta['file']]=data
   rows.append({**meta,'sha256':sha(data),'jpeg_quality':quality})
  manifest={'condition':condition,'runner_sha256':RUNNER_SHA,'trials':records,'images':rows,'scope':'Exact retained16k PCM direct inference; no fresh resampling or live transport/playout','crop_from_256px':[100,96,64,48],'archive_raw_pcm_included':False,'visual_acceptance':False}
  output=io.BytesIO()
  with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
   z.writestr('manifest.json',json.dumps(manifest,separators=(',',':')))
   for name,data in sorted(files.items()):z.writestr(name,data)
  data=output.getvalue()
  if len(data)<200000:return data,quality
 raise RuntimeError('Compact archive exceeds200000bytes; no evidence emitted')

async def main():
 gen=r.AvatarVideoGenerator(r.AvatarOptions(video_width=512,video_height=512,video_fps=25,audio_sample_rate=16000,audio_channels=1),service_url='http://127.0.0.1:8000',image_path='/probe/face.jpg')
 for _ in range(4):
  await gen.warmup(batches=1)
  while not gen._render_queue.empty():gen._render_queue.get_nowait()
 records=[];images=[]
 async with r.httpx.AsyncClient(timeout=r.httpx.Timeout(120)) as client:
  gen._http_client=client
  for trial,gain in enumerate([1.0,0.01]):
   pcm=Path(f'/probe/trial-{trial}.pcm').read_bytes()
   assert len(pcm)==368640 and sha(pcm)==EXPECTED[trial]
   assert gen._render_queue.empty()
   frames=[r.rtc.AudioFrame(data=pcm[i:i+1280],sample_rate=16000,num_channels=1,samples_per_channel=640) for i in range(0,len(pcm),1280)]
   assert len(frames)==288
   rms=[float(np.sqrt(np.mean(np.frombuffer(bytes(f.data),dtype='<i2').astype(float)**2)))/32768 for f in frames]
   if trial==0:last=max(i for i,x in enumerate(rms) if x>.001);assert last==105
   # Shared baseline reference preserved intentionally; exact threshold masks
   # are saved separately to avoid calling every reference-tail frame silence.
   full={last-53,last-23,last+5,last+25}
   calls=[];audio_out=[];tail_count=0;full_count=0
   for offset in range(0,len(frames),32):
    chunk=frames[offset:offset+32];block=b''.join(bytes(f.data) for f in chunk)
    normalized=gen._normalize_pcm(block);assert normalized==block
    n=await gen._run_inference_streaming(normalized,gen._generation,audio_chunks=chunk)
    assert n==32 and gen._render_queue.qsize()==32,(trial,offset,n,gen._render_queue.qsize())
    video_hash=hashlib.sha256();returned_audio=[]
    for index in range(32):
     vf,af=gen._render_queue.get_nowait();assert af is not None
     assert af.sample_rate==16000 and af.num_channels==1 and af.samples_per_channel==640
     audio=bytes(af.data);assert audio==bytes(chunk[index].data)
     returned_audio.append(audio);audio_out.append(audio)
     pos=offset+index;assert vf.type==r.rtc.VideoBufferType.RGBA and vf.width>0 and vf.height>0
     rgba=bytes(vf.data);assert len(rgba)==vf.width*vf.height*4;video_hash.update(rgba)
     if pos in full or last-5<=pos<=last+60:
      pixels=np.frombuffer(rgba,dtype=np.uint8).reshape(vf.height,vf.width,4)[:,:,:3]
      pixels=cv2.resize(pixels,(256,256),interpolation=cv2.INTER_AREA)
      meta={'trial':trial,'frame':pos,'after_reference_ms':(pos-last)*40,'paired_audio_rms':rms[pos]}
      if pos in full:
       images.append(({**meta,'kind':'full','file':f'visuals-{trial}/full-{pos:04}.jpg'},pixels.copy()));full_count+=1
      if last-5<=pos<=last+60:
       images.append(({**meta,'kind':'mouth','file':f'visuals-{trial}/mouth-{pos:04}.jpg'},pixels[96:144,100:164].copy()));tail_count+=1
    assert gen._render_queue.empty()
    output_audio=b''.join(returned_audio);assert output_audio==block
    calls.append({'index':offset//32,'requested_frames':32,'returned_frames':n,'model_input_bytes':len(normalized),'model_input_sha256':sha(normalized),'paired_input_sha256':sha(block),'paired_output_sha256':sha(output_audio),'decoded_rgba_sha256':video_hash.hexdigest(),'last_frame_dimensions':[vf.width,vf.height],'exception_type':None})
   assert b''.join(audio_out)==pcm and tail_count==66 and full_count==4 and len(calls)==9
   records.append({'trial':trial,'speech_gain':gain,'input_pcm_bytes':len(pcm),'input_pcm_sha256':sha(pcm),'frames':len(frames),'reference_frame':last,'reference':'last baseline40ms RMS>.001; not actual phonetic endpoint','rms_by_frame':rms,'last_frame_above_model_threshold':max((i for i,x in enumerate(rms) if x>.0001),default=None),'paired_audio_exact':True,'calls':calls,'mouth_images':tail_count,'full_images':full_count})
   emit('TAIL_COMPACT_RESULT',{'condition':condition,'trial':trial,'frames':len(frames),'calls':len(calls),'input_sha256':sha(pcm),'audio_exact':True})
 data,quality=make_archive(records,images)
 encoded=base64.b64encode(data).decode();parts=[encoded[i:i+320] for i in range(0,len(encoded),320)]
 emit('TAIL_COMPACT_ARCHIVE',{'condition':condition,'sha256':sha(data),'bytes':len(data),'parts':len(parts),'jpeg_quality':quality})
 for i,part in enumerate(parts):emit('TAIL_COMPACT_CHUNK',{'condition':condition,'part':i,'data':part})
 emit('TAIL_COMPACT_COMPLETE',{'condition':condition,'passed':True,'fullpath_acceptance':False,'visual_acceptance':False})
asyncio.run(asyncio.wait_for(main(),480))
