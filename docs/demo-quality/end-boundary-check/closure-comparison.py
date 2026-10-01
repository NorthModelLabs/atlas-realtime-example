import ast,hashlib,json,math,array,pathlib
repo=pathlib.Path(__file__).resolve().parents[3]
identity=next(x['functions'] for x in json.loads((repo/'docs/demo-quality/gate-and-recovery/gate-results.json').read_text()) if x['type']=='GATE_IDENTITY')
source=pathlib.Path('/Users/ericsheen/Desktop/avatarhub-production-audit/infra/images/avatar-runtime/renderer_iris/patch_learned_eye_retargeting.py').read_text();tree=ast.parse(source)
nodes={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in identity}
assert all(hashlib.sha256(ast.unparse(nodes[k]).encode()).hexdigest()==v for k,v in identity.items())
namespace={};exec(compile(ast.Module(body=[nodes[x] for x in ['_smoothstep01','_framewise_mouth_lock_weights']],type_ignores=[]),'verified-functions','exec'),namespace);f=namespace['_framewise_mouth_lock_weights']
raw=pathlib.Path('/private/tmp/atlas-voice-stage-probe-20260930/question.pcm').read_bytes();assert hashlib.sha256(raw).hexdigest()=='962289ba66028ad5b6de2b50b0f9152b16f2ba83c3b88e970aec006910b48b0b'
a=array.array('h');a.frombytes(raw);resampled=[]
for x in range(0,len(a)*2,3):
 i=x//2;t=(x%2)/2;v=a[i] if i+1>=len(a) else (1-t)*a[i]+t*a[i+1];resampled.append(round(v))
resampled += [0]*((-len(resampled))%640)
cases=[]
for gain in [1,.1,.01,.001]:
 samples=[round(x*gain)/32768 for x in resampled];rms=[math.sqrt(sum(v*v for v in samples[i:i+640])/640) for i in range(0,len(samples),640)]
 for noise in [0,6]:
  inp=[0.0]*32+rms+[noise/32768]*50+[0.0]*32
  base=f(inp,.0001,0.,0,8,4,2)[0];candidate=f(inp,.0001,0.,0,2,1,4)[0]
  changes=[{'frame':i-32,'rms':x,'base':base[i],'candidate':candidate[i]} for i,x in enumerate(inp) if 32<=i<32+len(rms) and candidate[i]>base[i]+1e-8]
  tail=32+len(rms)
  first=lambda weights:next((i*40 for i,v in enumerate(weights[tail:]) if v>=.999),None)
  cases.append({'gain':gain,'noise':noise,'more_closed_speech_frames':len(changes),'more_closed_frames_above_gate':sum(x['rms']>.0001 for x in changes),'more_closed_frames_above_observer_quiet':sum(x['rms']>.001 for x in changes),'changes':changes,'baseline_full_close_ms_after_fixture':first(base),'candidate_full_close_ms_after_fixture':first(candidate)})
pathlib.Path(__file__).with_name('closure-comparison.json').write_text(json.dumps({'cases':cases,'scope':'verified model helper, linearly resampled synthetic fixture, not a rendering acceptance'},indent=2))
print(json.dumps([{k:v for k,v in x.items() if k!='changes'} for x in cases],indent=2))
