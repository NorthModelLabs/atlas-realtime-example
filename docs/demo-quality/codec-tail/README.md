# Continuous-audio transport comparison

This is an unpromoted, preview-only hypothesis test for lingering mouth movement. The default public audio behavior remains unchanged. `NEXT_PUBLIC_TTS_CONTINUOUS_AUDIO=true` sets only `dtx: false` on the persistent TTS track published to Atlas. No sample gate, playback delay, resampling change, model/runner image, eye setting or mouth threshold is introduced. The comparison must preserve quiet speech and pass repeated visual tail checks before any promotion is considered.

The baseline negotiated answer contains `usedtx=1` for the outgoing synthesized track. Installed LiveKit client defaults enable DTX. A local browser loopback can verify codec negotiation and decode behavior but cannot stand in for the actual SFU/model/browser path. Production health and the ten-worker human image/configuration guard accompany the live preview check. Only owned synthetic test sessions are used and deleted.

The prior trace's provider stop event occurs 197–393 ms after observed source quiet in five tails. Residual low-level provider-decoded samples occur after that event. The [OpenAI server event reference](https://developers.openai.com/api/reference/resources/realtime/server-events#output_audio_buffer.stopped) identifies server-buffer drain, not client playout completion. It is therefore not safe to cut audio solely on this event. No such cut is implemented.

[Opus DTX](https://www.rfc-editor.org/rfc/rfc6716.html#section-2.1.9) reduces transmission during silence. [LiveKit's audio publishing options](https://docs.livekit.io/transport/media/advanced/) expose the setting. Neither source establishes DTX as this demo's cause; the experiment must do that.
