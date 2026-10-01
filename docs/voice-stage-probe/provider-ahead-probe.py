import base64,json,os,pathlib,time
import websocket
p=pathlib.Path(os.environ.get('PROBE_OUTPUT_DIR','.'))
# Public synthetic strings only. No production prompt, audio, or customer input.
instructions='You are a friendly voice assistant. Speak in English and follow the requested wording exactly.'
request='Say exactly: Hello. I am ready to help you with your next question.'
key=os.environ['OPENAI_API_KEY']
rows=[]
for trial in range(3):
 ws=None;row={'trial':trial,'model':'gpt-realtime-2.1','reasoning':'minimal','input':'public synthetic typed phrase','output_rate':24000};chunks=[]
 try:
  ws=websocket.create_connection('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1',header=['Authorization: Bearer '+key],timeout=20)
  json.loads(ws.recv())
  ws.send(json.dumps({'type':'session.update','session':{'type':'realtime','instructions':instructions,'reasoning':{'effort':'minimal'},'max_output_tokens':512,'output_modalities':['audio'],'audio':{'input':{'turn_detection':None},'output':{'format':{'type':'audio/pcm','rate':24000},'voice':'coral'}}}}))
  while True:
   event=json.loads(ws.recv())
   if event['type']=='error':raise RuntimeError('provider_configuration_rejected')
   if event['type']=='session.updated':break
  ws.send(json.dumps({'type':'conversation.item.create','item':{'type':'message','role':'user','content':[{'type':'input_text','text':request}]}}))
  start=time.monotonic();ws.send(json.dumps({'type':'response.create'}));total=0;deadline=start+30
  while time.monotonic()<deadline:
   event=json.loads(ws.recv());at=time.monotonic();kind=event['type']
   if kind=='error':raise RuntimeError('provider_response_error')
   if kind=='response.output_audio.delta':
    size=len(base64.b64decode(event['delta']));total+=size
    chunks.append({'after_request_ms':round((at-start)*1000,1),'cumulative_audio_ms':round(total/48,1),'chunk_audio_ms':round(size/48,1)})
   if kind=='response.done':row['status']=event['response']['status'];row['done_after_request_ms']=round((at-start)*1000,1);break
  else:raise TimeoutError('response_deadline')
  row['chunks']=chunks
  if chunks:
   first=chunks[0]['after_request_ms'];row['first_audio_after_request_ms']=first;row['audio_duration_ms']=chunks[-1]['cumulative_audio_ms'];row['all_audio_arrived_after_first_ms']=round(chunks[-1]['after_request_ms']-first,1)
   window=next((c for c in chunks if c['cumulative_audio_ms']>=1280),None)
   row['1280ms_audio_available_after_first_ms']=round(window['after_request_ms']-first,1) if window else None
   row['maximum_generated_ahead_of_playback_ms']=round(max(c['cumulative_audio_ms']-(c['after_request_ms']-first) for c in chunks),1)
 except Exception as error:row['error_type']=type(error).__name__
 finally:
  if ws:ws.close()
  rows.append(row);(p/'results.json').write_text(json.dumps(rows,indent=2));print(json.dumps({k:v for k,v in row.items() if k!='chunks'}),flush=True)
