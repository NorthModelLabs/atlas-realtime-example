"""Opt-in adapter for a staging agent that exclusively owns PCM audio ingress.

The host must use trusted session metadata for driver_identity/input_mode,
disable media forwarding for that PCM session, and await aclose() at shutdown.
The sink's clear() must be a verified receiver-side barrier. The ordinary
DataStreamAudioOutput.clear_buffer() fire-and-forget method is insufficient.
"""
from bridge import BridgeError, PcmBridge

METHOD = "atlas.pcm.v1"


def register(room, driver_identity, sink, *, enabled=False, input_mode="media"):
    if not enabled:
        return None
    if input_mode != "pcm_v1":
        raise BridgeError("PCM ingress needs an exclusive PCM session")
    from livekit import rtc

    bridge = PcmBridge(driver_identity, sink, enabled=True)

    @room.local_participant.register_rpc_method(METHOD)
    async def handle(data):
        try:
            return await bridge.handle(data.caller_identity, data.payload)
        except BridgeError as error:
            raise rtc.RpcError(code=1400, message=str(error)) from None

    class Registration:
        closed = False

        async def aclose(self):
            if self.closed:
                return
            self.closed = True
            try:
                room.local_participant.unregister_rpc_method(METHOD)
            finally:
                await bridge.close()

    return Registration()
