"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceResponseQueue } from "./voice-response";
import { captionEvent, emptyCaptions, type Captions } from "./voice-captions";
import { probeAudio, probeStats, voiceProbe } from "./voice-diagnostics";

type Output = { context: AudioContext; destination: MediaStreamAudioDestinationNode };
type Options = {
  sessionId: string | null;
  output: () => Promise<Output>;
  user: (text: string) => void;
  assistant: (text: string) => void;
  thinking: (value: boolean) => void;
  error: (text: string) => void;
};
type Connection = {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  mic?: MediaStream;
  source?: MediaStreamAudioSourceNode;
  abort: AbortController;
  ready: boolean;
  turns: VoiceResponseQueue;
  captions: Captions;
  probes: Array<() => void>;
};

export function useRealtimeVoice(options: Options) {
  const opts = useRef(options); opts.current = options;
  const current = useRef<Connection | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [isListening, setListening] = useState(false);
  const [captions, setCaptions] = useState(emptyCaptions);
  const stop = useCallback(() => {
    const c = current.current; current.current = null;
    if (c) {
      c.probes.forEach(cleanup => cleanup());
      c.abort.abort(); c.mic?.getTracks().forEach(t => t.stop());
      c.source?.disconnect(); c.channel.close(); c.peer.close();
    }
    setConnected(false); setListening(false); setCaptions(emptyCaptions()); opts.current.thinking(false);
  }, []);
  const start = useCallback(async () => {
    if (current.current || !opts.current.sessionId) return;
    opts.current.error("");
    const id = opts.current.sessionId;
    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel("oai-events");
    const c: Connection = {peer, channel, abort: new AbortController(), ready: false, turns: new VoiceResponseQueue(event => channel.send(JSON.stringify(event))), captions: emptyCaptions(), probes: []};
    current.current = c;
    const alive = () => current.current === c;
    try {
      const output = await opts.current.output();
      if (!alive()) return;
      c.mic = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
      if (!alive()) { c.mic.getTracks().forEach(t => t.stop()); return; }
      c.mic.getAudioTracks().forEach(t => peer.addTrack(t, c.mic!));
      c.probes.push(probeAudio(output.context, c.mic, "microphone_audio"), probeStats(() => peer.getStats(), "provider_rtc"));
      peer.ontrack = event => {
        if (!alive()) return;
        c.source?.disconnect();
        c.source = output.context.createMediaStreamSource(new MediaStream([event.track]));
        // Send streaming speech to Atlas. Only the avatar's synchronized return
        // track plays locally, so users do not hear two voices.
        c.source.connect(output.destination);
        c.probes.push(probeAudio(output.context, new MediaStream([event.track]), "provider_audio"));
      };
      channel.onmessage = ({data}) => {
        if (!alive()) return;
        let event; try { event = JSON.parse(data); } catch { return; }
        if (["input_audio_buffer.speech_started", "input_audio_buffer.speech_stopped", "response.created", "response.done", "output_audio_buffer.started", "output_audio_buffer.stopped", "output_audio_buffer.cleared"].includes(event.type)) voiceProbe(event.type, {status: event.response?.status});
        if (event.type === "response.created" && event.response?.id) c.turns.created(event.response.id);
        if (event.type === "response.done" && event.response?.id) c.turns.done(event.response.id);
        const superseded = c.turns.ignores(event.response_id || event.response?.id);
        const previous = c.captions;
        c.captions = superseded ? previous : captionEvent(previous, event);
        setCaptions(c.captions);
        if (event.type === "input_audio_buffer.speech_started") {opts.current.thinking(false);}
        if (event.type === "input_audio_buffer.speech_stopped") {opts.current.thinking(true);}
        if (event.type === "conversation.item.input_audio_transcription.completed") {
          if (event.transcript?.trim()) opts.current.user(event.transcript.trim());
        }
        if (event.type === "conversation.item.input_audio_transcription.failed") opts.current.error("Could not transcribe that turn. Please try again.");
        if (event.type === "response.created") opts.current.thinking(true);
        if (!superseded && event.type === "response.output_audio_transcript.delta" && event.response_id === previous.responseId) opts.current.thinking(false);
        if (!superseded && event.type === "response.output_audio_transcript.done" && event.response_id === previous.responseId && event.transcript?.trim()) opts.current.assistant(event.transcript.trim());
        if (event.type === "response.done") {
          opts.current.thinking(c.turns.busy);
          if (event.response?.status === "failed") opts.current.error("Voice response failed. Please try again.");
        }
        if (event.type === "error") {
          c.turns.failed(event.error?.event_id);
          voiceProbe("provider_error", {code: typeof event.error?.code === "string" && /^[a-z_]{1,80}$/.test(event.error.code) ? event.error.code : "unknown"});
          // A completion may race with a cancellation already sent in flight.
          if (event.error?.code !== "response_cancel_not_active") {opts.current.thinking(false); opts.current.error("Voice request failed. Please try again.");}
        }
      };
      peer.onconnectionstatechange = () => {
        if (alive() && peer.connectionState === "failed") {stop(); opts.current.error("Voice disconnected. Tap the microphone to reconnect.");}
      };
      const opened = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Voice connection timed out")), 30000);
        const finish = (error?: Error) => {clearTimeout(timeout); c.abort.signal.removeEventListener("abort", aborted); if (error) reject(error); else resolve();};
        const aborted = () => finish(new Error("Connection cancelled"));
        c.abort.signal.addEventListener("abort", aborted, {once: true});
        channel.onopen = () => finish();
        channel.onerror = () => finish(new Error("Voice channel failed"));
      });
      // Negotiation can fail before the open promise is awaited.
      void opened.catch(() => {});
      channel.onclose = () => {if (alive()) {stop(); opts.current.error("Voice disconnected. Tap the microphone to reconnect.");}};
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      const response = await fetch(`/api/session/${id}/voice`, {
        method: "POST", headers: {"Content-Type": "application/sdp"}, body: offer.sdp, signal: c.abort.signal,
      });
      if (!response.ok) throw new Error("Voice connection failed. Tap the microphone to retry.");
      const answer = await response.text(); if (!alive()) return;
      await peer.setRemoteDescription({type: "answer", sdp: answer});
      await opened; if (!alive()) return;
      c.ready = true; setConnected(true); setListening(true);
    } catch (error) {
      if (!alive()) return;
      stop(); opts.current.error(error instanceof Error ? error.message : "Voice connection failed");
    }
  }, [stop]);
  const toggleMicrophone = useCallback(() => {
    const c = current.current;
    if (!c) { void start(); return; }
    if (!c.ready) return;
    const enabled = !c.mic?.getAudioTracks()[0]?.enabled;
    c.mic?.getAudioTracks().forEach(t => {t.enabled = enabled;}); setListening(enabled);
  }, [start]);
  const sendText = useCallback((text: string) => {
    const c = current.current;
    if (!c?.ready || c.channel.readyState !== "open") {opts.current.error("Voice is connecting. Try again in a moment."); return;}
    voiceProbe("typed_input");
    opts.current.error("");
    opts.current.thinking(true);
    c.turns.submit(text);
    c.captions = {...emptyCaptions(), user: text}; setCaptions(c.captions);
  }, []);
  useEffect(() => stop, [stop]);
  return {start, stop, toggleMicrophone, sendText, isConnected, isListening, partialTranscript: captions.partial, captions};
}
