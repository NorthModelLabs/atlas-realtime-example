import hashlib,json,pathlib
p=pathlib.Path(__file__).parent
obs=json.loads((p/'queued-observation.json').read_text())
summary={'status':obs['status'],'complete':obs['complete'],'frames_retained':len(obs['frames']),'incomplete_frames':obs['incomplete_frames'],'invalid_serial_records':obs.get('invalid_serial_records',0),'trials':[],'accepted_fix':False,'limits':['Synthetic PCM was pushed through exact runner resampling, queuing and normalization.','No OpenAI or LiveKit codec input was captured.','No latency benchmark: diagnostic I/O and synthetic consumer affect timing.']}
for result in obs['results']:
 if 'renderer_inputs' not in result:continue
 paired=[r for r in result['renderer_inputs'] if r['paired_audio'] is not None]
 equal=[r['model_input_sha256']==r['paired_audio']['sha256'] for r in paired if r['model_input_bytes']==r['paired_audio']['bytes']]
 audio=result['output_audio_rms_40ms'];end=result['last_voiced_output_frame'];tail=audio[end+1:]
 summary['trials'].append({'trial':result['trial'],'noise_level_pcm16':result['noise_level_pcm16'],'capture_manifest':result['capture_manifest'],'inference_calls':len(result['renderer_inputs']),'paired_inference_calls':len(paired),'full_length_input_pair_hashes_equal':all(equal),'full_length_pairs_compared':len(equal),'paired_output_frames':result['paired_frames'],'last_voiced_frame':end,'following_frames_above_model_silence_gate':sum(x/32768>.0001 for x in tail),'tail_rms_pcm16_first_60_frames':tail[:60],'review_frames':[f for f in obs['frames'] if f['trial']==result['trial']]})
(p/'queued-analysis.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='trials'}));print(json.dumps([{'trial':t['trial'],'calls':t['inference_calls'],'tail_frames_above_gate':t['following_frames_above_model_silence_gate'],'recording_error':t['capture_manifest']['disabled_reason']} for t in summary['trials']]))
