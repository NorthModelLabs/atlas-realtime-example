"""Isolated pinned-SDK stream-end test, no model or production credentials."""
import asyncio, base64, hashlib, hmac, importlib.metadata, json, time
from livekit import rtc
from livekit.agents.voice.avatar import DataStreamAudioOutput, DataStreamAudioReceiver, AudioSegmentEnd
def token(identity):
    def enc(value): return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    body=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'iss':'devkey','sub':identity,'exp':int(time.time())+300,'nbf':int(time.time())-10,'video':{'roomJoin':True,'room':'isolated-pcm','canPublish':True,'canSubscribe':True,'canPublishData':True}})
    return (body+b'.'+base64.urlsafe_b64encode(hmac.new(b'secret',body,hashlib.sha256).digest()).rstrip(b'=')).decode()

async def main():
    rooms=[]; receiver=None; output=None; consumer=None
    try:
        for identity in ['bridge-agent','avatar-owned']:
            room=rtc.Room(); rooms.append(room)
            await room.connect('ws://172.28.51.2:7880',token(identity))
        agent,avatar=rooms
        receiver=DataStreamAudioReceiver(avatar,sender_identity='bridge-agent',frame_size_ms=40)
        await receiver.start()
        output=DataStreamAudioOutput(agent,destination_identity='avatar-owned',sample_rate=24000)
        returned=[]; pending=[]; markers=asyncio.Queue()
        async def consume():
            async for item in receiver:
                if isinstance(item,rtc.AudioFrame):
                    assert item.sample_rate==24000 and item.num_channels==1
                    pending.append(bytes(item.data))
                elif isinstance(item,AudioSegmentEnd):
                    returned.append(b''.join(pending));pending.clear()
                    await markers.put(len(returned))
                    receiver.notify_playback_finished(playback_position=len(returned[-1])/48000,interrupted=False)
        consumer=asyncio.create_task(consume())
        for n,samples in enumerate([240,12000,24000]):
            pcm=bytes([n+1,0])*samples
            for offset in range(0,len(pcm),4800):
                chunk=pcm[offset:offset+4800]
                await output.capture_frame(rtc.AudioFrame(data=chunk,sample_rate=24000,num_channels=1,samples_per_channel=len(chunk)//2))
            output.flush()
            await asyncio.wait_for(markers.get(),10)
            await asyncio.wait_for(output.wait_for_playout(),10)
            assert returned[-1]==pcm, (samples,len(returned[-1])//2)
            assert not consumer.done() and agent.isconnected() and avatar.isconnected()
        print('STREAM_RESULT '+json.dumps({'passed':True,'livekit_sdk':importlib.metadata.version('livekit'),'livekit_agents':importlib.metadata.version('livekit-agents'),'server':'v1.13.7','samples_per_turn':[len(x)//2 for x in returned],'exact_pcm':True,'receiver_alive_after_end':True,'rooms_connected_after_end':True,'playback_notifications_received':True,'scope':'actual DataStreamAudioOutput/Receiver; no AvatarRunner rendering, resampling or GPU'}),flush=True)
    finally:
        if consumer:
            consumer.cancel(); await asyncio.gather(consumer,return_exceptions=True)
        if receiver: await receiver.aclose()
        await asyncio.gather(*(r.disconnect() for r in rooms))
        print("STREAM_CLEANUP rooms_disconnected",flush=True)

asyncio.run(asyncio.wait_for(main(),90))
