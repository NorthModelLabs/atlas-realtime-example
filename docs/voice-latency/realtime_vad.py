import websocket,json,time,pathlib,base64,threading,array
root=pathlib.Path('/private/tmp/atlas-voice-latency-20260930');e=json.loads(pathlib.Path('/private/tmp/atlas-demo-restore-20260930/apple-env.private.json').read_text());pcm=(root/'input.pcm').read_bytes();samples=array.array('h',pcm);last=max(i for i,v in enumerate(samples) if abs(v)>500)/24000; rows=[]
for trial in range(3):
 ws=None;row={'model':'gpt-realtime-2.1','trial':trial+1,'vad_silence_ms':500}
 try:
  ws=websocket.create_connection('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1',header=['Authorization: Bearer '+e['OPENAI_API_KEY']],timeout=20);json.loads(ws.recv())
  ws.send(json.dumps({'type':'session.update','session':{'type':'realtime','instructions':'Follow the user request. Reply briefly in one short sentence.','audio':{'input':{'format':{'type':'audio/pcm','rate':24000},'turn_detection':{'type':'server_vad','silence_duration_ms':500,'threshold':.5,'prefix_padding_ms':300}},'output':{'format':{'type':'audio/pcm','rate':24000},'voice':'coral'}},'output_modalities':['audio']}}))
  while True:
   d=json.loads(ws.recv())
   if d['type']=='error':raise ValueError(d['error']['message'])
   if d['type']=='session.updated':break
  start=time.monotonic();end_speech=start+last;audio=pcm+bytes(48000);stop=threading.Event()
  def send():
   for pos in range(0,len(audio),2400):
    if stop.is_set():break
    ws.send(json.dumps({'type':'input_audio_buffer.append','audio':base64.b64encode(audio[pos:pos+2400]).decode()}));time.sleep(max(0,start+(pos+2400)/48000-time.monotonic()))
  th=threading.Thread(target=send);th.start();first=None;chunks=[];transcript=''
  while True:
   d=json.loads(ws.recv());kind=d['type'];now=time.monotonic()
   if kind=='error':raise ValueError(d['error']['message'])
   if kind=='input_audio_buffer.speech_stopped':row['speech_stop_event_after_input_s']=round(now-end_speech,3)
   if kind=='response.output_audio.delta':
    if first is None:first=now;row['speech_end_to_first_audio_s']=round(now-end_speech,3)
    chunks.append(base64.b64decode(d['delta']))
   if kind=='response.output_audio_transcript.delta':transcript+=d['delta']
   if kind=='response.done':row.update(status=d['response']['status'],transcript=transcript,complete_after_speech_s=round(now-end_speech,3));break
  stop.set();th.join();(root/f'realtime-vad-{trial+1}.pcm').write_bytes(b''.join(chunks))
 except Exception as ex:row['error']=str(ex)[:500]
 finally:
  if ws:ws.close()
  rows.append(row);print(json.dumps(row),flush=True);(root/'realtime-vad-results.json').write_text(json.dumps(rows,indent=2))
