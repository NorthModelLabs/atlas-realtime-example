"""Isolated LiveKit wire acceptance; synthetic sink, no models/customer data."""
import asyncio, base64, hashlib, hmac, importlib.metadata, json, time
from livekit import rtc
from livekit_ingress import register, METHOD

def token(identity):
    def enc(value): return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    body=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'iss':'devkey','sub':identity,'exp':int(time.time())+300,'nbf':int(time.time())-10,'video':{'roomJoin':True,'room':'isolated-pcm','canPublish':True,'canSubscribe':True,'canPublishData':True}})
    return (body+b'.'+base64.urlsafe_b64encode(hmac.new(b'secret',body,hashlib.sha256).digest()).rstrip(b'=')).decode()

class Sink:
    def __init__(self): self.data=[]; self.ends=0; self.clears=0
    async def write(self,data): self.data.append(data)
    async def end(self): self.ends+=1
    async def clear(self): self.clears+=1

async def main():
    rooms=[]; registration=None
    try:
        for identity in ['bridge-agent','driver-owned','viewer-other']:
            room=rtc.Room(); rooms.append(room)
            await room.connect('ws://172.28.51.2:7880',token(identity))
        agent,driver,viewer=rooms
        async def participants_ready():
            while any(len(r.remote_participants)<2 for r in rooms): await asyncio.sleep(.05)
        await asyncio.wait_for(participants_ready(),10)
        sink=Sink(); registration=register(agent,'driver-owned',sink,enabled=True,input_mode='pcm_v1')
        async def rpc(room,message):
            return json.loads(await room.local_participant.perform_rpc(destination_identity='bridge-agent',method=METHOD,payload=json.dumps(message),response_timeout=6))
        try:
            await rpc(viewer,{'op':'open','turn':'forged'})
            raise AssertionError('unauthorized viewer accepted')
        except rtc.RpcError as e:
            assert e.code==1400 and 'Unauthorized' in e.message
        assert not sink.data
        generation=(await rpc(driver,{'op':'open','turn':'response_1'}))['generation']
        chunks=[bytes([i+1,0])*4800 for i in range(4)]
        def push(seq): return {'op':'push','generation':generation,'seq':seq,'pcm':base64.b64encode(chunks[seq]).decode()}
        replies=await asyncio.gather(*(rpc(driver,push(i)) for i in [2,1,0,3]))
        assert sink.data==chunks and sorted(r['seq'] for r in replies)==list(range(4))
        await rpc(driver,push(3)); assert sink.data==chunks
        end={'op':'end','generation':generation,'count':4}
        result=await rpc(driver,end); assert result=={'sealed':True,'forwarded_samples':19200}
        await rpc(driver,end); assert sink.ends==1
        await rpc(driver,{'op':'cancel','generation':generation}); assert sink.clears==1
        replacement=(await rpc(driver,{'op':'open','turn':'response_2'}))['generation']
        assert replacement!=generation
        try:
            await rpc(driver,push(0)); raise AssertionError('stale generation accepted')
        except rtc.RpcError as e: assert e.code==1400 and 'Stale' in e.message
        await rpc(driver,{'op':'end','generation':replacement,'count':0})
        assert sink.ends==2
        await registration.aclose(); registration=None
        assert sink.clears==2
        try:
            await rpc(driver,{'op':'open','turn':'after_close'}); raise AssertionError('closed method remained registered')
        except rtc.RpcError as e: assert e.code==1400
        print('WIRE_RESULT '+json.dumps({'passed':True,'livekit_sdk':importlib.metadata.version('livekit'),'server':'v1.13.7','unauthorized_denied':True,'ordered_pcm_bytes':sum(map(len,sink.data)),'duplicate_idempotent':True,'ends':sink.ends,'stale_generation_denied':True,'unregistered_after_close':True,'scope':'real SDK/RPC; fake capture sink; private network; no GPU or production endpoints'}),flush=True)
    finally:
        if registration: await registration.aclose()
        await asyncio.gather(*(r.disconnect() for r in rooms),return_exceptions=True)

asyncio.run(asyncio.wait_for(main(),90))
