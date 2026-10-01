import websocket,json,time,pathlib,base64,os
root=pathlib.Path('/private/tmp/atlas-voice-latency-20260930');e=json.loads(pathlib.Path('/private/tmp/atlas-demo-restore-20260930/apple-env.private.json').read_text());pcm=(root/'input.pcm').read_bytes();rows=[]
for model in ['gpt-realtime-2.1','gpt-realtime']:
 for trial in range(3):
  row={'model':model,'trial':trial+1,'mode':'paced PCM input, explicit commit; excludes VAD'}
  ws=None
  try:
   begin=time.monotonic();ws=websocket.create_connection('wss://api.openai.com/v1/realtime?model='+model,header=['Authorization: Bearer '+e['OPENAI_API_KEY']],timeout=25)
   d=json.loads(ws.recv())
   if d['type']=='error':row['error']=d.get('error');break
   row['connection_s']=round(time.monotonic()-begin,3)
   ws.send(json.dumps({'type':'session.update','session':{'type':'realtime','instructions':'You are a friendly concise assistant. Respond in one short sentence.','audio':{'input':{'format':{'type':'audio/pcm','rate':24000},'turn_detection':None},'output':{'format':{'type':'audio/pcm','rate':24000},'voice':'coral'}},'output_modalities':['audio']}}))
   while True:
    d=json.loads(ws.recv())
    if d['type']=='error':raise ValueError(json.dumps(d['error']))
    if d['type']=='session.updated':break
   start=time.monotonic()
   for pos in range(0,len(pcm),4800):
    ws.send(json.dumps({'type':'input_audio_buffer.append','audio':base64.b64encode(pcm[pos:pos+4800]).decode()}));time.sleep(max(0,start+(pos+len(pcm[pos:pos+4800]))/48000-time.monotonic()))
   end=time.monotonic();ws.send(json.dumps({'type':'input_audio_buffer.commit'}));ws.send(json.dumps({'type':'response.create'}));chunks=[];first=None;transcript=''
   while True:
    d=json.loads(ws.recv());kind=d['type']
    if kind=='error':raise ValueError(json.dumps(d['error']))
    if kind=='response.output_audio.delta':
     if first is None:first=time.monotonic()-end
     chunks.append(base64.b64decode(d['delta']))
    if kind=='response.output_audio_transcript.delta':transcript+=d['delta']
    if kind=='response.done':
     row.update(status=d['response']['status'],first_audio_s=round(first,3) if first else None,complete_s=round(time.monotonic()-end,3),transcript=transcript,audio_bytes=sum(map(len,chunks)));break
   (root/f'{model}-{trial+1}.pcm').write_bytes(b''.join(chunks))
  except Exception as ex:row['error']=str(ex)[:600]
  finally:
   if ws:ws.close()
   rows.append(row);print(json.dumps(row),flush=True);(root/'realtime-results.json').write_text(json.dumps(rows,indent=2))
  if 'error' in row:break
