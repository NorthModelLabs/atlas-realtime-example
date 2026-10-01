import hashlib,importlib.util,json,os,pathlib,re,sys,zipfile
p=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location('verify_capture','/Users/ericsheen/Desktop/avatarhub-production-audit/.codex-work/apple-demo-restore-20260930/scripts/diagnostics/verify_renderer_capture.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
o=json.loads((p/'observation.json').read_text());reports=[]
for condition in ['baseline','clamp','repeat']:
 archive=p/(condition+'-capture.zip')
 if not archive.exists():continue
 root=p/(condition+'-private-pcm');root.mkdir(mode=0o700,exist_ok=True)
 with zipfile.ZipFile(archive) as z:
  assert len(z.infolist())<1000 and sum(x.file_size for x in z.infolist())<16*1024*1024
  for x in z.infolist():
   assert re.fullmatch(r'trial-[01]/(?:manifest\.json|\d{4}(?:\.json|-outcome\.json|-model-input\.pcm|-paired-audio\.pcm))',x.filename),x.filename
   target=root/x.filename;target.parent.mkdir(mode=0o700,exist_ok=True)
   data=z.read(x)
   if target.exists():assert target.read_bytes()==data
   else:
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data)
 for trial in range(2):
  folder=root/('trial-'+str(trial));audit=v.verify(folder)
  result=next((x for x in o['results'] if x['condition']==condition and x['trial']==trial),None)
  paired=b''.join(x.read_bytes() for x in sorted(folder.glob('*-paired-audio.pcm')))
  audit['matches_submitted_input']=bool(result and hashlib.sha256(paired).hexdigest()==result['input_pcm_sha256'] and len(paired)==result['input_pcm_bytes'] and audit['paired_frames']==result['frames'])
  audit['condition']=condition;audit['trial']=trial
  audit['archive_sha256']=hashlib.sha256(archive.read_bytes()).hexdigest()
  # Preserve distinction from full browser/LiveKit drain.
  audit['full_transport_drain_verified']=False
  reports.append(audit)
passed=len(reports)==6 and all(x['inference_calls_accounted'] and x['matches_submitted_input'] for x in reports)
image_hashes_ok=all(hashlib.sha256((p/f['file']).read_bytes()).hexdigest()==f['jpeg_sha256'] for f in o['frames'])
input_matches=all(len({x['input_pcm_sha256'] for x in o['results'] if x['trial']==trial})==1 for trial in range(2)) and len(o['results'])==6
out={'captures':reports,'all_six_captures_accounted':passed,'same_input_across_conditions':input_matches,'retained_frames':len(o['frames']),'image_hashes_ok':image_hashes_ok,'incomplete_frames':o['incomplete_frames'],'missing_visuals_not_accepted':True,'scope':'Direct original model/runner only, not full transport; visual acceptance separate'}
(p/'capture-analysis.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
