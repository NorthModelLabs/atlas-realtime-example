import ast, asyncio, pathlib, types, json
p=pathlib.Path(__file__).parent
src=(p/'warmup-deployed-fixture.py').read_text();tree=ast.parse(src)
cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='WorkerLauncher')
methods=[n for n in cls.body if isinstance(n,ast.AsyncFunctionDef) and n.name in ['_warmup_loop','_cancel_warmup_request']]
base='\n\n'.join(ast.unparse(n) for n in methods)
old=next(line for line in base.splitlines() if line.strip()=='await self._warmup_request_task')
assert base.count(old)==1
indent=old[:len(old)-len(old.lstrip())]
new='\n'.join(indent+line for line in [
 'try:',
 '    await self._warmup_request_task',
 'except asyncio.CancelledError:',
 '    # A customer launch cancels the idle request, not this loop.',
 '    if asyncio.current_task().cancelling():',
 '        raise',
 '    self.telemetry.record("warmup_request_cancelled")',
])
patched=base.replace(old,new)
ast.parse(patched)
async def check(source,expect_survival):
 ns={'asyncio':asyncio,'DISPATCHER_WARMUP_INTERVAL_SECONDS':0.01}
 exec(compile(source,'live-warmup-methods','exec'),ns)
 class Fake:
  def __init__(self):
   self.draining=False;self.busy=False;self.calls=0;self.started=asyncio.Event();self._warmup_request_task=None;self.telemetry=types.SimpleNamespace(record=lambda *a,**k:None)
  def has_active_workers(self):return self.busy
  async def _run_avatar_service_warmup(self):
   self.calls+=1;self.started.set();await asyncio.Event().wait()
 f=Fake();loop=asyncio.create_task(ns['_warmup_loop'](f));await asyncio.wait_for(f.started.wait(),1)
 f.busy=True;await ns['_cancel_warmup_request'](f);await asyncio.sleep(0)
 survived=not loop.done()
 if not expect_survival:
  assert not survived and loop.cancelled();return {'loop_survives_customer_launch':False,'reproduced':True}
 assert survived
 await asyncio.sleep(1.1);assert f.calls==1,'warmup must not run during a customer session'
 f.started.clear();f.busy=False;await asyncio.wait_for(f.started.wait(),2)
 assert f.calls==2
 loop.cancel()
 try:await loop
 except asyncio.CancelledError:pass
 assert loop.cancelled() and f._warmup_request_task.cancelled()
 return {'loop_survives_customer_launch':True,'skips_while_busy':True,'resumes_after_session':True,'shutdown_cancels_loop_and_request':True}
async def main():
 r={'deployed':await check(base,False),'candidate':await check(patched,True)};(p/'warmup-cancellation-test.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
asyncio.run(main())
