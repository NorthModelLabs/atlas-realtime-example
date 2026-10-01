import asyncio,struct
from pathlib import Path
from contextlib import asynccontextmanager
source=Path('/probe/runner_probe.py').read_text()
assert source.endswith('asyncio.run(main())\n')
ns={'__name__':'runner_probe_dryrun'}
exec(compile(source.rsplit('asyncio.run(main())',1)[0],'/probe/runner_probe.py','exec'),ns)
class Response:
 headers={'content-type':'application/x-avatar-stream'}
 def raise_for_status(self):pass
 async def aiter_bytes(self):
  await asyncio.sleep(.4)
  for i in range(32):
   if i:await asyncio.sleep(.029)
   record=b'\1'+struct.pack('>IHHB',i,64,64,3)+bytes([i])*64*64*3
   yield struct.pack('>I',len(record))+record
  record=b'\2'+struct.pack('>I',32)
  yield struct.pack('>I',len(record))+record
class Client:
 def __init__(self,*args,**kwargs):pass
 async def aclose(self):pass
 async def __aenter__(self):return self
 async def __aexit__(self,*args):pass
 @asynccontextmanager
 async def stream(self,*args,**kwargs):yield Response()
ns['r'].httpx.AsyncClient=Client
asyncio.run(ns['main']())
