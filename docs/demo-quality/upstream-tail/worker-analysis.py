import json,pathlib,collections
p=pathlib.Path(__file__).parent;logs=json.loads((p/'owned-dispatcher-logs.private.json').read_text());out=[];workers=[]
for group in logs:
 if group['owned_matches']:workers.append(group['pod'])
 for line in group['owned_matches']:
  if '{' not in line:continue
  try:row=json.loads(line[line.index('{'):])
  except ValueError:continue
  if row.get('type')!='turn_latency':continue
  out.append({k:v for k,v in row.items() if k in ['stage','ts','inference_ms','frames','fps_equiv','queue_delay_ms','input_lag_ms','render_q','audio_q','audio_q_ms','waited_ms','reason','warmup']})
(p/'gpu-events.json').write_text(json.dumps(out,indent=2)+'\n')
render=[r['inference_ms'] for r in out if r['stage']=='gpu_render_batch_timing' and 'inference_ms' in r]
summary={'workers':workers,'event_counts':dict(collections.Counter(r['stage'] for r in out)),'render_batch_ms_min':min(render,default=None),'render_batch_ms_max':max(render,default=None),'limits':'Only owned-session matching log lines. No claim that all batches are logged or clocks synchronized.'};(p/'worker-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
