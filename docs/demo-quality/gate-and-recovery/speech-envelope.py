import ast,hashlib,json,math,array,pathlib
p=pathlib.Path(__file__).parent
source=pathlib.Path('/Users/ericsheen/Desktop/avatarhub-production-audit/infra/images/avatar-runtime/renderer_iris/patch_learned_eye_retargeting.py').read_text();tree=ast.parse(source)
verified=next(x['functions'] for x in json.loads((p/'results.json').read_text()) if x['type']=='GATE_IDENTITY');nodes={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in verified}
assert all(hashlib.sha256(ast.unparse(nodes[k]).encode()).hexdigest()==v for k,v in verified.items());namespace={};exec(compile(ast.Module(body=[nodes[x] for x in ['_smoothstep01','_framewise_mouth_lock_weights']],type_ignores=[]),'verified-functions','exec'),namespace);f=namespace['_framewise_mouth_lock_weights']
raw=pathlib.Path('/private/tmp/atlas-voice-stage-probe-20260930/question.pcm').read_bytes();assert hashlib.sha256(raw).hexdigest()=='962289ba66028ad5b6de2b50b0f9152b16f2ba83c3b88e970aec006910b48b0b';a=array.array('h');a.frombytes(raw)
resampled=[]
for x in range(0,len(a)*2,3):
 i=x//2;t=(x%2)/2;v=a[i] if i+1>=len(a) else (1-t)*a[i]+t*a[i+1];resampled.append(round(v))
resampled += [0]*((-len(resampled))%640);results=[]
for gain in [1,0.1,0.01]:
 samples=[round(x*gain)/32768 for x in resampled];rms=[math.sqrt(sum(v*v for v in samples[i:i+640])/640) for i in range(0,len(samples),640)];weights={str(t):f([0.0]*32+rms+[0.0]*32,t,0.,0,8,4,2)[0][32:32+len(rms)] for t in [0.0001,0.0003]};a=weights['0.0001'];b=weights['0.0003'];changed=[i for i,(x,y) in enumerate(zip(a,b)) if abs(x-y)>1e-8];voiced_changed=[i for i in changed if rms[i]>0.001]
 results.append({'gain':gain,'speech_frames':len(rms),'changed_envelope_frames':len(changed),'changed_frames_above_observer_quiet_threshold':len(voiced_changed),'max_additional_close_weight':max(y-x for x,y in zip(a,b)),'changed_frame_details':[{'frame':i,'rms':rms[i],'baseline_weight':a[i],'candidate_weight':b[i]} for i in changed]})
out={'fixture_sha256':hashlib.sha256(raw).hexdigest(),'functions_verified_against_exact_model_ast':True,'cases':results,'limitation':'Envelope regression control only. Quiet speech and visual articulation still require rendered acceptance; 0.01 gain is deliberately far quieter than normal fixture.'};(p/'speech-envelope.json').write_text(json.dumps(out,indent=2));print(json.dumps([{k:v for k,v in x.items() if k!='changed_frame_details'} for x in results],indent=2))
