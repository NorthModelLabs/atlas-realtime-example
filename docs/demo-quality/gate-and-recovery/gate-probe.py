import ast,hashlib,json
from pathlib import Path
path=Path('/workspace/atlas_avatar/workers/animate_worker.py');source=path.read_text();tree=ast.parse(source)
names=['_smoothstep01','_framewise_mouth_lock_weights']
funcs={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names};assert set(funcs)==set(names)
module=ast.Module(body=[funcs[x] for x in names],type_ignores=[]);space={};exec(compile(module,str(path),'exec'),space)
f=space['_framewise_mouth_lock_weights'];print('GATE_IDENTITY '+json.dumps({'file_sha256':hashlib.sha256(source.encode()).hexdigest(),'functions':{k:hashlib.sha256(ast.unparse(v).encode()).hexdigest() for k,v in funcs.items()}}),flush=True)
for threshold in [0.0001,0.0003]:
 for level in [0,2,6,32,100]:
  rms=[0.01]*8+[level/32768]*32+[0.0]*25
  weights,progress,silent=f(rms,threshold,0.,0,8,4,2)
  full=next((i-8 for i,w in enumerate(weights) if i>=8 and w>=.999),None)
  print('GATE_CASE '+json.dumps({'threshold':threshold,'noise_pcm16':level,'tail_full_lock_frame':full,'tail_full_lock_ms':None if full is None else (full+1)*40,'tail_weights':weights[8:],'scope':'actual installed helper; input envelope only, not visual acceptance'}),flush=True)
# Confirm how the function is called and which other behavior uses this envelope.
for n in ast.walk(tree):
 if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in ['_framewise_mouth_lock_weights','_pcm_wav_frame_rms','_smooth_head_pose_rotation','_smooth_head_translation']:
  print('GATE_CALL '+json.dumps({'function':n.func.id,'line':n.lineno,'expression':ast.unparse(n)}),flush=True)
print('GATE_COMPLETE '+json.dumps({'passed':True,'gpu_calls':0,'production_changes':False}),flush=True)
