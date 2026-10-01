import ast,base64,hashlib,io,json,math,sys,zipfile
from pathlib import Path
import cv2,numpy as np
import analyze
P=Path(__file__).parent
# Exercise actual archive producer functions without importing runner/network.
tree=ast.parse((P/'probe.py').read_text())
subset=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['sha','emit','make_archive']],type_ignores=[])
ns=dict(RUNNER_SHA='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec',hashlib=hashlib,json=json,cv2=cv2,io=io,zipfile=zipfile,condition='baseline')
exec(compile(subset,'probe.py','exec'),ns)
records=[];images=[]
for t in [0,1]:
 pcm=(P/f'trial-{t}.pcm').read_bytes();assert len(pcm)==368640 and analyze.sha(pcm)==analyze.EXPECTED[t]
 frames=[pcm[i:i+1280] for i in range(0,len(pcm),1280)];assert b''.join(frames)==pcm
 rms=[float(np.sqrt(np.mean(np.frombuffer(f,dtype='<i2').astype(float)**2)))/32768 for f in frames]
 calls=[]
 for i in range(9):
  block=pcm[i*40960:(i+1)*40960];sha=analyze.sha(block)
  calls.append(dict(index=i,requested_frames=32,returned_frames=32,model_input_bytes=40960,model_input_sha256=sha,paired_input_sha256=sha,paired_output_sha256=sha,decoded_rgba_sha256='0'*64,last_frame_dimensions=[512,512],exception_type=None))
 records.append(dict(trial=t,speech_gain=[1.0,.01][t],input_pcm_bytes=len(pcm),input_pcm_sha256=analyze.sha(pcm),frames=288,reference_frame=105,rms_by_frame=rms,last_frame_above_model_threshold=max((i for i,x in enumerate(rms) if x>.0001),default=None),paired_audio_exact=True,calls=calls,mouth_images=66,full_images=4))
 for kind,indices in [('full',[52,82,110,130]),('mouth',range(100,166))]:
  for n in indices:
   f=Path('/private/tmp/atlas-mouth-close-chunked-20261001')/f'baseline-capture/visuals-{t}/{n:04}.jpg'
   pix=cv2.cvtColor(cv2.imread(str(f)),cv2.COLOR_BGR2RGB)
   if kind=='mouth':pix=pix[96:144,100:164]
   images.append((dict(trial=t,frame=n,after_reference_ms=(n-105)*40,paired_audio_rms=rms[n],kind=kind,file=f'visuals-{t}/{kind}-{n:04}.jpg'),pix))
data,quality=ns['make_archive'](records,images)
header={'bytes':len(data),'sha256':analyze.sha(data),'jpeg_quality':quality}
m,files=analyze.validate_archive(data,header,'baseline',[(P/f'trial-{t}.pcm').read_bytes() for t in [0,1]])
assert len(files)==141 and len(data)<200000
encoded=base64.b64encode(data).decode();parts=[encoded[i:i+320] for i in range(0,len(encoded),320)]
assert max(len('TAIL_COMPACT_CHUNK '+json.dumps(dict(condition='baseline',part=i,data=x),separators=(',',':'))) for i,x in enumerate(parts))<512
assert base64.b64decode(''.join(parts),validate=True)==data
for label,damaged,h in [('truncated',data[:-1],header),('hash',data,{**header,'sha256':'0'*64})]:
 try:analyze.validate_archive(damaged,h,'baseline',[(P/f'trial-{t}.pcm').read_bytes() for t in [0,1]])
 except (AssertionError,zipfile.BadZipFile):pass
 else:raise AssertionError('Corruption accepted:'+label)
bad=bytearray((P/'trial-1.pcm').read_bytes());bad[0]^=1
try:analyze.validate_archive(data,header,'baseline',[(P/'trial-0.pcm').read_bytes(),bytes(bad)])
except AssertionError:pass
else:raise AssertionError('Changed PCM accepted')
receipt={'synthetic_archive_bytes':len(data),'jpeg_quality':quality,'entries':len(files),'serial_parts':len(parts),'max_serial_line_chars':max(len('TAIL_COMPACT_CHUNK '+json.dumps(dict(condition='baseline',part=i,data=x),separators=(',',':'))) for i,x in enumerate(parts)),'checks':['complete archive CRC/SHA/content shape','exact retained PCM frame assembly','per-call fixed PCM fingerprints','RMS/reference masks','truncated archive rejected','wrong archive hash rejected','mutated PCM rejected','serial line bounds and roundtrip'],'scope':'Local archive/fixture tests only; recycled baseline JPEGs and synthetic outcomes; no model execution'}
(P/'local-test-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
# Test contact generation in an explicitly synthetic, separate output directory.
import tempfile
with tempfile.TemporaryDirectory(prefix='compact-contact-local-',dir=P) as tmp:
 q=Path(tmp)
 for name,raw in files.items():
  dest=q/'baseline-capture'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
 (q/'capture-analysis.json').write_text(json.dumps({'reports':[{'condition':'baseline','archive_integrity_verified':True}]}))
 exec(compile((P/'contact.py').read_text(),'contact.py','exec'),{'__file__':str(q/'contact.py'),'__name__':'__main__'})
 from PIL import Image
 for trial in [0,1]:
  gif=Image.open(q/f'trial-{trial}-mouth-index-sequence.gif')
  assert gif.n_frames==66 and gif.info['duration']==40
  assert (q/f'trial-{trial}-tail-contact.png').exists()
print('Synthetic contact generation:2×66frame GIFs at40ms; contacts pass; temp outputs removed.')
