import collections,json,pathlib,statistics
p=pathlib.Path(__file__).parent;r=json.loads((p/'events.json').read_text());frames=json.loads((p/'frames.json').read_text());groups=collections.defaultdict(list)
for f in frames:groups[f['at']-f['sinceAudioEndMs']].append(f)
stages=['provider_audio_window','atlas_outgoing_audio_window','atlas_return_audio_window']
def summarize(rows):
 return {'windows':len(rows),'observations':sum(x.get('observations',0) for x in rows),'peak_rms':max((x.get('peakRms',0) for x in rows),default=None),'min_rms':min((x.get('minRms',0) for x in rows),default=None),'above_visual_gate_observations':sum(x.get('aboveVisualGate',0) for x in rows),'below_observer_quiet_observations':sum(x.get('belowObserverQuiet',0) for x in rows)}
tails=[]
for end,shots in groups.items():
 if len(shots)<3:continue
 source_stops=[x['at'] for x in r if x['stage']=='atlas_outgoing_audio' and not x['active'] and end-10000<=x['at']<=end+200]
 source_stop=source_stops[-1] if source_stops else None
 tails.append({'returned_quiet_at':end,'screenshot_offsets_ms':[f['sinceAudioEndMs'] for f in shots],'files':[f['file'] for f in shots], 'most_recent_source_quiet_at':source_stop,'returned_minus_source_quiet_ms':end-source_stop if source_stop else None,'after_returned_quiet_200_to_1500ms':{stage:summarize([x for x in r if x['stage']==stage and end+200<=x['at']<=end+1500]) for stage in stages},'after_source_quiet_200_to_1500ms':{stage:summarize([x for x in r if x['stage']==stage and source_stop and source_stop+200<=x['at']<=source_stop+1500]) for stage in stages}})
paths={stage:[dict(t) for t in {tuple(sorted({k:v for k,v in x.items() if k.endswith(('CandidateType','Protocol'))}.items())) for x in r if x['stage']==stage and x.get('type')=='candidate-pair'}] for stage in ['provider_rtc','atlas_outgoing_rtc','atlas_return_video_rtc']}
gaps=[x for x in r if x['stage']=='atlas_video_frame' and x.get('displayGapMs',0)>100]
out={'events':len(r),'video_callbacks':sum(x['stage']=='atlas_video_frame' for x in r),'stage_counts':dict(collections.Counter(x['stage'] for x in r)),'tail_windows':tails,'transport_paths':paths,'video_gaps_over_100ms':[{k:x.get(k) for k in ['at','displayGapMs','processingMs','captureMs','receiveMs','expectedDisplayMs']} for x in gaps],'limits':['Browser sampled RMS is not model-input PCM; browser resampling, Opus encoding/decoding and packet concealment lie between the measurement and the model.','Prior source quiet can be a pause rather than the final response end; it is not a latency benchmark.','One synthetic call/network path; no inference that all users share this transport issue.']}
(p/'analysis.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'events':len(r),'complete_tails':len(tails),'paths':paths,'gaps_over_100ms':len(gaps)},indent=2))
