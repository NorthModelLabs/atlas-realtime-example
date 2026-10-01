from pathlib import Path
import json
source=Path('/Users/ericsheen/Desktop/avatarhub-production-audit/.codex-work/apple-demo-restore-20260930/docs/demo-quality/upstream-tail')
events=json.loads((source/'events.json').read_text());tails=json.loads((source/'analysis.json').read_text())['tail_windows'];results=[]
for i,t in enumerate(tails):
 q=t['most_recent_source_quiet_at'];stops=[e['at'] for e in events if e['stage']=='output_audio_buffer.stopped' and q-500<=e['at']<=q+1500]
 assert len(stops)==1
 stop=stops[0]
 rows=[e for e in events if e['stage']=='provider_audio_window' and stop+150<=e['at']<=stop+800]
 results.append({'tail':i+1,'source_quiet_at':q,'returned_quiet_at':t['returned_quiet_at'],'provider_server_stop_at':stop,'stop_after_source_quiet_ms':stop-q,'post_stop_150_to_800ms_windows':len(rows),'post_stop_peak_rms':max(e['peakRms'] for e in rows),'post_stop_above_visual_gate_observations':sum(e['aboveVisualGate'] for e in rows)})
out={'source':'upstream-tail/events.json','tails':results,'finding':'Low-level provider-decoded signals remain after the server drain event in all five samples.','limits':['Server drain is not client playout completion; no audio gate is justified from the server event alone.','Only sampled browser audio, not model-input PCM.','Does not yet prove the transport or provider is the root cause.']}
Path('/private/tmp/atlas-mouth-codec-20261001/event-boundaries.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(results))
