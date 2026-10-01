import ast,asyncio,pathlib,types,json,sys,os,hashlib,time
from unittest.mock import patch
source=pathlib.Path(sys.argv[1]).read_text();fixture=pathlib.Path(sys.argv[2]);tree=ast.parse(source);cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='WorkerLauncher')
methods={n.name:ast.unparse(n) for n in cls.body if isinstance(n,ast.AsyncFunctionDef) and n.name in ['_warmup_loop','_cancel_warmup_request','_run_avatar_service_warmup']}
assert set(methods)=={'_warmup_loop','_cancel_warmup_request','_run_avatar_service_warmup'}
assert 'AVATAR_IMAGE_PATH' not in methods['_run_avatar_service_warmup']
assert '/workspace/warmup-face.jpg' in methods['_run_avatar_service_warmup']
ns={'asyncio':asyncio,'os':os,'Path':pathlib.Path,'hashlib':hashlib,'time':time,'_epoch_ms':lambda:int(time.time()*1000),'DISPATCHER_WARMUP_INTERVAL_SECONDS':0.01,'DISPATCHER_WARMUP_MAX_FRAMES':32,'DISPATCHER_WARMUP_STREAM_FORMAT':'binary','DISPATCHER_WARMUP_TIMEOUT_SECONDS':12}
exec(compile('\n\n'.join(methods.values()),'candidate-methods','exec'),ns)
class Fake:
 def __init__(self):
  self.draining=False;self.busy=False;self.calls=0;self.started=asyncio.Event();self._warmup_request_task=None;self.telemetry=types.SimpleNamespace(record=lambda *a,**k:None)
 def has_active_workers(self):return self.busy
 async def _run_avatar_service_warmup(self):
  self.calls+=1;self.started.set();await asyncio.Event().wait()
async def cancellation():
 f=Fake();loop=asyncio.create_task(ns['_warmup_loop'](f));await asyncio.wait_for(f.started.wait(),1)
 try:
  f.busy=True;await ns['_cancel_warmup_request'](f);await asyncio.sleep(0);assert not loop.done()
  await asyncio.sleep(1.1);assert f.calls==1
  f.started.clear();f.busy=False;await asyncio.wait_for(f.started.wait(),2);assert f.calls==2
 finally:
  loop.cancel()
  try:await loop
  except asyncio.CancelledError:pass
 assert loop.cancelled() and f._warmup_request_task.cancelled()
async def fixture_isolation():
 expected=fixture.read_bytes();assert hashlib.sha256(expected).hexdigest()=='650077d085e32b8d8834a5b5320a0fd1d379d1346f5ef4d9e8f476b7cf123e4f'
 class Response:
  async def __aenter__(self):return self
  async def __aexit__(self,*a):pass
  def raise_for_status(self):pass
  async def aiter_bytes(self):yield b'test-frame'
 class Client:
  def stream(self,method,url,**kwargs):
   assert method=='POST' and url=='http://localhost:8000/tasks/stream/bytes'
   assert kwargs['files']['image_file'][1]==expected
   return Response()
 f=Fake();f._http_client=Client();f._warmup_seq=0;f._warmup_wav_bytes=lambda:b'synthetic';f._image_content_type=lambda p:'image/jpeg'
 async def ready():return {'ready':True}
 f.avatar_health=ready
 with patch.dict(os.environ,{'AVATAR_WARMUP_IMAGE_PATH':str(fixture),'AVATAR_IMAGE_PATH':'/customer-selected-image-must-not-be-read'},clear=True):
  frames=await ns['_run_avatar_service_warmup'](f)
 assert frames==1 and f._warmup_last_ok_ms>0 and f._warmup_last_error==''
async def main():
 await cancellation();await fixture_isolation();print(json.dumps({'cancellation_survives':True,'busy_session_skipped':True,'resumes_when_idle':True,'shutdown_cancels':True,'warmup_fixture_independent_of_customer_face':True}))
asyncio.run(main())
