import ast,asyncio,hashlib,io,json,math,os,time,types,wave
from pathlib import Path
import httpx
source=Path('/workspace/dispatcher.py').read_text()
assert hashlib.sha256(source.encode()).hexdigest()=='bc4c608860e8910af60ae7a09469f563325b9e4a85a4ddc5327a73182eb96be3'
assert hashlib.sha256(Path('/workspace/warmup-face.jpg').read_bytes()).hexdigest()=='650077d085e32b8d8834a5b5320a0fd1d379d1346f5ef4d9e8f476b7cf123e4f'
cls=next(n for n in ast.parse(source).body if isinstance(n,ast.ClassDef) and n.name=='WorkerLauncher')
names={'_run_avatar_service_warmup','_warmup_wav_bytes','_image_content_type'}
methods=[n for n in cls.body if getattr(n,'name',None) in names]
for n in methods:n.decorator_list=[]
ns=dict(globals(),_epoch_ms=lambda:int(time.time()*1000),DISPATCHER_WARMUP_SAMPLE_RATE=24000,DISPATCHER_WARMUP_FPS=25,DISPATCHER_WARMUP_CONTEXT_WINDOW=32,DISPATCHER_WARMUP_MAX_FRAMES=32,DISPATCHER_WARMUP_STREAM_FORMAT='binary',DISPATCHER_WARMUP_TIMEOUT_SECONDS=12)
exec(compile(ast.fix_missing_locations(ast.Module(body=methods,type_ignores=[])),'candidate-warmup-methods','exec'),ns)
class Client:
 _warmup_wav_bytes=staticmethod(ns['_warmup_wav_bytes'])
 _image_content_type=staticmethod(ns['_image_content_type'])
 def has_active_workers(self):return False
 async def avatar_health(self):
  r=await self._http_client.get('http://127.0.0.1:8000/health',timeout=5)
  return {'ready':r.status_code==200 and r.json().get('status') in ['ok','healthy','ready','operational'],'status':r.status_code}
from contextlib import asynccontextmanager
import struct
class ValidatedClient:
 def __init__(self,client):self.client=client
 async def get(self,*a,**k):return await self.client.get(*a,**k)
 @asynccontextmanager
 async def stream(self,*a,**k):
  async with self.client.stream(*a,**k) as response:
   assert 'application/x-avatar-stream' in response.headers.get('content-type','')
   class ValidatedResponse:
    def raise_for_status(self):response.raise_for_status()
    async def aiter_bytes(self):
     buffer=bytearray();frames=0;ended=False
     async for chunk in response.aiter_bytes():
      buffer.extend(chunk)
      while len(buffer)>=4:
       size=struct.unpack('>I',buffer[:4])[0]
       assert 0<size<200000000
       if len(buffer)<4+size:break
       record=bytes(buffer[4:4+size]);del buffer[:4+size]
       assert record[0]!=3
       if record[0]==1:
        assert len(record)>=10
        index,h,w,c=struct.unpack('>IHHB',record[1:10]);assert len(record[10:])==h*w*c;frames+=1
       if record[0]==2:ended=True
      yield chunk
     assert not buffer and ended and frames==32,'invalid warmup frame stream'
   yield ValidatedResponse()

async def main():
 c=Client();c._warmup_seq=0;c.telemetry=types.SimpleNamespace(record=lambda *a,**k:None)
 async with httpx.AsyncClient(trust_env=False) as client:
  c._http_client=ValidatedClient(client)
  for trial in range(3):
   chunks=await ns['_run_avatar_service_warmup'](c)
   assert chunks>0 and c._warmup_last_ok_ms>0 and not c._warmup_last_error
   print('VOICE_WARMUP_RESULT '+json.dumps({'trial':trial,'chunks':chunks,'elapsed_ms':c._warmup_last_elapsed_ms,'success':True,'candidate_source_verified':True,'public_fixture_verified':True,'validated_frames':32}),flush=True)
asyncio.run(main())
