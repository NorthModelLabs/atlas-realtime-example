import requests,json,time,pathlib
root=pathlib.Path('/private/tmp/atlas-voice-latency-20260930')
e=json.loads(pathlib.Path('/private/tmp/atlas-demo-restore-20260930/apple-env.private.json').read_text())
text='Hello from Atlas! I can help you explore real-time avatars and answer your questions.'
s=requests.Session(); results=[]
for i in range(3):
 for provider in (['eleven-current','openai-stream'] if i%2==0 else ['openai-stream','eleven-current']):
  if provider=='eleven-current':
   url='https://api.elevenlabs.io/v1/text-to-speech/'+e['ELEVENLABS_VOICE_ID'];headers={'xi-api-key':e['ELEVENLABS_API_KEY']};body={'text':text,'model_id':'eleven_turbo_v2_5','voice_settings':{'stability':.5,'similarity_boost':.75}};ext='mp3'
  else:
   url='https://api.openai.com/v1/audio/speech';headers={'Authorization':'Bearer '+e['OPENAI_API_KEY']};body={'input':text,'model':'gpt-4o-mini-tts','voice':'coral','response_format':'pcm'};ext='pcm'
  start=time.monotonic(); chunks=[];first=None
  with s.post(url,headers=headers,json=body,stream=True,timeout=45) as r:
   status=r.status_code
   if status==200:
    for chunk in r.iter_content(chunk_size=960):
     if chunk:
      if first is None:first=time.monotonic()-start
      chunks.append(chunk)
   row={'provider':provider,'trial':i+1,'status':status,'first_960_bytes_s':round(first,3) if first else None,'complete_s':round(time.monotonic()-start,3),'bytes':sum(map(len,chunks))}
   if status!=200:row['error']=r.text[:400]
  if chunks:(root/f'{provider}-{i+1}.{ext}').write_bytes(b''.join(chunks))
  results.append(row);print(json.dumps(row),flush=True)
  (root/'tts-results.json').write_text(json.dumps({'text':text,'trials':results},indent=2))
