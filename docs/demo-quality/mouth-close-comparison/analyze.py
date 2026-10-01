"""Strict complete-archive validation for fixed-PCM direct inference only."""
import array,base64,hashlib,io,json,math,os,re,zipfile
from pathlib import Path
P=Path(__file__).parent
EXPECTED=['26c3f4c421ffb3c12022e46e6e970fbff8bf04faf38f07e46cb4facda761c586','205fa644b0dafb306b310c425cbe99979409a77eb925f7fab3628828624e1eab']
ALLOWED=re.compile(r'manifest\.json|visuals-[01]/(?:full|mouth)-\d{4}\.jpg')
def sha(x):return hashlib.sha256(x).hexdigest()
def validate_archive(data,header,condition,fixtures):
 assert len(data)==header['bytes'] and len(data)<200000 and sha(data)==header['sha256']
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  entries=z.infolist();names=[x.filename for x in entries]
  assert len(entries)==141 and len(set(names))==141 and sum(x.file_size for x in entries)<2*1024*1024
  assert all(ALLOWED.fullmatch(x.filename) and not x.is_dir() and not x.flag_bits&1 for x in entries)
  files={x.filename:z.read(x) for x in entries} # zipfile enforces CRC for each complete entry
 m=json.loads(files['manifest.json'])
 assert m['condition']==condition and m['runner_sha256']=='55807a14915bb9d3b8862fcf8f93d0b05ae939d4916f445d68dd87d5677a7bec'
 assert m['crop_from_256px']==[100,96,64,48] and m['archive_raw_pcm_included'] is False and m['visual_acceptance'] is False
 assert len(m['trials'])==2 and [x['trial'] for x in m['trials']]==[0,1]
 for t,trial in enumerate(m['trials']):
  pcm=fixtures[t];assert len(pcm)==368640 and sha(pcm)==EXPECTED[t]
  assert trial['input_pcm_bytes']==len(pcm) and trial['input_pcm_sha256']==sha(pcm)
  assert trial['frames']==288 and trial['paired_audio_exact'] is True and trial['reference_frame']==105 and trial['speech_gain']==[1.0,.01][t]
  rms=[]
  for off in range(0,len(pcm),1280):
   v=array.array('h',pcm[off:off+1280]);rms.append(math.sqrt(sum(x*x for x in v)/len(v))/32768)
  assert len(trial['rms_by_frame'])==288 and all(abs(a-b)<1e-12 for a,b in zip(rms,trial['rms_by_frame']))
  assert trial['last_frame_above_model_threshold']==max((i for i,x in enumerate(rms) if x>.0001),default=None)
  assert len(trial['calls'])==9
  for i,call in enumerate(trial['calls']):
   block=pcm[i*40960:(i+1)*40960]
   assert call['index']==i and call['requested_frames']==call['returned_frames']==32 and call['model_input_bytes']==40960 and call['exception_type'] is None
   assert call['model_input_sha256']==call['paired_input_sha256']==call['paired_output_sha256']==sha(block)
   assert re.fullmatch('[a-f0-9]{64}',call['decoded_rgba_sha256'])
   assert len(call['last_frame_dimensions'])==2 and all(type(x) is int and 0<x<=4096 for x in call['last_frame_dimensions'])
  assert trial['mouth_images']==66 and trial['full_images']==4
  for kind,frames in [('mouth',set(range(100,166))),('full',{52,82,110,130})]:
   rows=[x for x in m['images'] if x['trial']==t and x['kind']==kind]
   assert len(rows)==len(frames) and {x['frame'] for x in rows}==frames
   for im in rows:
    f=f"visuals-{t}/{kind}-{im['frame']:04}.jpg"
    assert im['file']==f and f in files and sha(files[f])==im['sha256']
    assert im['after_reference_ms']==(im['frame']-105)*40 and abs(im['paired_audio_rms']-rms[im['frame']])<1e-12
    assert im['jpeg_quality']==header['jpeg_quality'] and im['jpeg_quality'] in [60,55,50,45,40]
 assert len(m['images'])==140 and set(files)=={'manifest.json'}|{x['file'] for x in m['images']}
 return m,files

def main():
 headers={};chunks={};complete=set();invalid=0
 for log in P.glob('serial*.log'):
  for line in log.read_text().splitlines():
   marker=next((x for x in ['TAIL_COMPACT_ARCHIVE ','TAIL_COMPACT_CHUNK ','TAIL_COMPACT_COMPLETE '] if x in line),None)
   if not marker:continue
   try:d=json.JSONDecoder().raw_decode(line.split(marker,1)[1])[0]
   except ValueError:invalid+=1;continue
   c=d['condition'];assert c in ['baseline','clamp','repeat']
   if marker=='TAIL_COMPACT_ARCHIVE ':
    assert c not in headers or headers[c]==d;headers[c]=d
   elif marker=='TAIL_COMPACT_CHUNK ':
    i=d['part'];assert type(i) is int and 0<=i<1000 and isinstance(d['data'],str) and 0<len(d['data'])<=320
    bucket=chunks.setdefault(c,{})
    assert i not in bucket or bucket[i]==d['data'];bucket[i]=d['data']
   elif d['passed'] is True:complete.add(c)
 fixtures=[(P/f'trial-{i}.pcm').read_bytes() for i in [0,1]]
 reports=[];missing=[]
 for c,h in headers.items():
  assert type(h['parts']) is int and 0<h['parts']<1000
  parts=chunks.get(c,{})
  assert all(0<=i<h['parts'] for i in parts)
  if set(parts)!=set(range(h['parts'])):
   missing.append({'condition':c,'missing_chunks':h['parts']-len(parts)});continue
  assert all(len(parts[i])==320 for i in range(h['parts']-1))
  data=base64.b64decode(''.join(parts[i] for i in range(h['parts'])),validate=True)
  m,files=validate_archive(data,h,c,fixtures)
  root=P/(c+'-capture');root.mkdir(mode=0o700,exist_ok=True)
  for name,raw in files.items():
   dest=root/name;dest.parent.mkdir(mode=0o700,exist_ok=True)
   if dest.exists():assert dest.read_bytes()==raw
   else:
    fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(raw)
  reports.append({'condition':c,'archive_sha256':h['sha256'],'archive_bytes':h['bytes'],'archive_integrity_verified':True,'completion_marker':c in complete,'trials':2,'frames_per_trial':288,'mouth_frames_per_trial':66,'jpeg_quality':h['jpeg_quality'],'model_input_fingerprints_equal_expected':True})
 summary={'reports':reports,'missing':missing,'all_conditions_accounted':{x['condition'] for x in reports}=={'baseline','clamp','repeat'} and complete=={'baseline','clamp','repeat'},'invalid_serial_lines':invalid,'fullpath_acceptance':False,'visual_acceptance':False,'limitation':'Original full RGBA hashes are producer receipts only; archive retains reduced JPEG evidence, not all raw video.'}
 (P/'capture-analysis.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
if __name__=='__main__':main()
