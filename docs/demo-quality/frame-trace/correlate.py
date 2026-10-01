import collections,json,pathlib,statistics
p=pathlib.Path(__file__).parent;rows=json.loads((p/'events.json').read_text());v=[r for r in rows if r['stage']=='atlas_video_frame'];groups=collections.defaultdict(list)
for r in json.loads((p/'frames.json').read_text()):groups[r['at']-r['sinceAudioEndMs']].append(r)
tails=[]
for stop,shots in groups.items():
 if len(shots)<3:continue
 frames=[r for r in v if stop<=r['at']<=stop+1500]
 audio=[r for r in rows if r['stage']=='atlas_return_audio_window' and stop+200<=r['at']<=stop+1500]
 tails.append({'audio_stop':stop,'screenshot_offsets_ms':[r['sinceAudioEndMs'] for r in shots],'video_callbacks_next_1500ms':len(frames),'presented_frames_advance':frames[-1]['frames']-frames[0]['frames'] if len(frames)>1 else None,'max_display_gap_ms':max((r.get('displayGapMs',0) for r in frames),default=None),'max_return_audio_rms_after_200ms':max((r['peakRms'] for r in audio),default=None)})
gpu=[]
for group in json.loads((p/'owned-dispatcher-logs.private.json').read_text()):
 for line in group['owned_matches']:
  if '{' not in line:continue
  try:r=json.loads(line[line.index('{'):])
  except ValueError:continue
  if r.get('type')=='turn_latency':gpu.append({k:v for k,v in r.items() if k in ['stage','ts','inference_ms','frames','fps_equiv','queue_delay_ms','input_lag_ms','render_q','audio_q','audio_q_ms','waited_ms','reason','warmup']})
(p/'gpu-events.json').write_text(json.dumps(gpu,indent=2))
gaps=json.loads((p/'frame-analysis.json').read_text())['gaps_over_100ms'];matches=[]
for gap in gaps:
 near=[r for r in gpu if abs(r['ts']-gap['at'])<=1500]
 matches.append({'video_gap':gap,'worker_events_nearby':near})
result={'tails':tails,'video_gap_worker_correlation':matches,'matched_worker':'main-security-9','worker_event_counts':dict(collections.Counter(r['stage'] for r in gpu)),'limitations':'Cross-machine Date.now timestamps lack a measured clock-skew bound; use stage/interval patterns, not sub-frame time alignment as proof.'}
(p/'correlation.json').write_text(json.dumps(result,indent=2));print(json.dumps({'tails':tails,'worker_event_counts':result['worker_event_counts']},indent=2))
