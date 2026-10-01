import json,pathlib,collections
p=pathlib.Path(__file__).parent;r=json.loads((p/'events.json').read_text());g=json.loads((p/'frame-analysis.json').read_text())['gaps_over_100ms'];gpu=json.loads((p/'gpu-events.json').read_text());out=[]
fields=['packetsLost','nackCount','pliCount','firCount','retransmittedPacketsReceived','framesReceived','framesDecoded','framesDropped','framesAssembledFromMultiplePackets','totalAssemblyTime','packetsDiscarded','concealedSamples','concealmentEvents']
for gap in g:
 t=gap['at'];start=t-gap['display_gap_ms'];record={'gap':gap,'returned_audio_active_at_gap_start':next((x['active'] for x in reversed(r) if x['stage']=='atlas_return_audio' and x['at']<=start),False),'receiver_windows':[]}
 for peer in [1,2]:
  stats=[x for x in r if x['stage']=='paired_receiver_stats' and x['peer']==peer]
  before=next((x for x in reversed(stats) if x['at']<=start-100),None);after=next((x for x in stats if x['at']>=t+100),None)
  if not before or not after:continue
  for kind in ['audio','video']:
   a=next((x for x in before['rows'] if x['kind']==kind),None);b=next((x for x in after['rows'] if x['kind']==kind),None)
   if a is None or b is None:continue
   record['receiver_windows'].append({'peer':peer,'kind':kind,'start':before['at'],'end':after['at'],'duration_ms':after['at']-before['at'],'delta':{k:round(b[k]-a[k],6) for k in fields if k in a and k in b}})
 record['gpu_events']=[x for x in gpu if start-1000<=x['ts']<=t+1000]
 out.append(record)
summary={'playout_timestamp_available':any('estimatedPlayoutTimestamp' in x for e in r if e['stage']=='paired_receiver_stats' for x in e['rows']), 'events':out, 'limits':'Receiver windows bracket display gaps, so correlation is not exact packet-level attribution. Same-peer A/V playout comparison unavailable if Chromium omits estimatedPlayoutTimestamp. No sender-side publication timing.'}
(p/'recovery-analysis.json').write_text(json.dumps(summary,indent=2))
print(json.dumps({'playout_timestamp_available':summary['playout_timestamp_available'],'largest_events':[{'gap':e['gap'],'active':e['returned_audio_active_at_gap_start'],'windows':e['receiver_windows'],'gpu_special':[x for x in e['gpu_events'] if x['stage'] not in ['gpu_render_batch_timing','gpu_batch_submitted','gpu_batch_done']]} for e in out if e['gap']['display_gap_ms']>250],'gpu_special':[x for x in gpu if x['stage'].startswith('audio_queue') ]},indent=2))
