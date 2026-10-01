import json,pathlib,statistics
p=pathlib.Path(__file__).parent
rows=json.loads((p/'scheduler-events.json').read_text())
starts=[r['at'] for r in rows if r['stage']=='input_audio_buffer.speech_started']
turns=[]
for i,start in enumerate(starts):
 end=starts[i+1] if i+1<len(starts) else float('inf')
 part=[r for r in rows if start<=r['at']<end]
 def first(stage,after=0):return next((r['at'] for r in part if r['stage']==stage and r.get('active') and r['at']>=after),None)
 provider=first('provider_audio')
 if provider is None:continue
 mic=[r['at'] for r in part if r['stage']=='microphone_audio' and r.get('active') is False and r['at']<provider]
 out=first('atlas_outgoing_audio',provider-50);returned=first('atlas_return_audio',provider)
 if mic and out and returned:turns.append({'turn':i+1,'provider_ms':provider-mic[-1],'bridge_ms':out-provider,'atlas_ms':returned-out,'e2e_ms':returned-mic[-1]})
stats={}
for stage in ('provider_rtc','atlas_return_audio_rtc','atlas_return_video_rtc','atlas_outgoing_rtc'):
 for kind in ('audio','video'):
  part=[r for r in rows if r['stage']==stage and r.get('kind')==kind and r.get('type')==('outbound-rtp' if stage=='atlas_outgoing_rtc' else 'inbound-rtp')]
  if not part:continue
  first,last=part[0],part[-1];out={}
  for key in ('insertedSamplesForDeceleration','removedSamplesForAcceleration','packetsReceived','packetsSent','packetsLost','concealedSamples','silentConcealedSamples','concealmentEvents','totalSamplesReceived','framesDecoded','framesDropped','freezeCount','totalFreezesDuration'):
   if key in last and key in first:out[key+'_delta']=last[key]-first[key]
  if last.get('jitterBufferEmittedCount',0)>first.get('jitterBufferEmittedCount',0):out['mean_jitter_buffer_ms']=round(1000*(last['jitterBufferDelay']-first['jitterBufferDelay'])/(last['jitterBufferEmittedCount']-first['jitterBufferEmittedCount']),1)
  for field in ('jitterBufferTargetDelay','jitterBufferMinimumDelay'):
   count=last.get('jitterBufferEmittedCount',0)-first.get('jitterBufferEmittedCount',0)
   if field in first and field in last and count>0:out[field+'_mean_ms']=round(1000*(last[field]-first[field])/count,1)
  if any('jitter' in x for x in part):out['max_jitter_ms']=round(max(x.get('jitter',0) for x in part)*1000,1)
  stats[stage+':'+kind]=out
  out['interruption_increments']=[{'since_first_s':round((b['at']-rows[0]['at'])/1000,2),'field':key,'increment':b.get(key,0)-a.get(key,0)} for a,b in zip(part,part[1:]) for key in ('concealmentEvents','freezeCount','totalFreezesDuration') if b.get(key,0)>a.get(key,0)]
scheduler=[r for r in rows if r['stage']=='browser_scheduler']
summary={'samples':len(scheduler),'max_delay_ms':max((x['maxDelayMs'] for x in scheduler),default=None),'max_long_task_ms':max((x['longestTaskMs'] for x in scheduler),default=None),'hidden_samples':sum(not x['visible'] for x in scheduler),'suspended_samples':sum(x['audioState']!='running' for x in scheduler),'stalls':[{'since_first_s':round((x['at']-rows[0]['at'])/1000,2),'max_delay_ms':x['maxDelayMs'],'long_task_ms':x['longestTaskMs']} for x in scheduler if x['maxDelayMs']>50 or x['longestTaskMs']>50]}
result={'scheduler':summary,'scope':'owned instrumented preview, synthetic microphone fixture, actual provider and public Atlas path; small sample, not user network','turns':turns,'warm_turn_median_e2e_ms':statistics.median(x['e2e_ms'] for x in turns[1:]) if len(turns)>1 else None,'transport':stats,'provider_errors':sum(x['stage']=='provider_error' for x in rows)}
(p/'scheduler-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
