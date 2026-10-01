"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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
  responding: boolean;
};

export function useRealtimeVoice(options: Options) {
  const opts = useRef(options); opts.current = options;
  const current = useRef<Connection | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [isListening, setListening] = useState(false);
  const [partialTranscript, setPartial] = useState("");
  const stop = useCallback(() => {
    const c = current.current; current.current = null;
    if (c) {
      c.abort.abort(); c.mic?.getTracks().forEach(t => t.stop());
      c.source?.disconnect(); c.channel.close(); c.peer.close();
    }
    setConnected(false); setListening(false); setPartial(""); opts.current.thinking(false);
  }, []);
  const start = useCallback(async () => {
    if (current.current || !opts.current.sessionId) return;
    opts.current.error("");
    const id = opts.current.sessionId;
    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel("oai-events");
    const c: Connection = {peer, channel, abort: new AbortController(), ready: false, responding: false};
    current.current = c;
    const alive = () => current.current === c;
    try {
      const output = await opts.current.output();
      if (!alive()) return;
      c.mic = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
      if (!alive()) { c.mic.getTracks().forEach(t => t.stop()); return; }
      c.mic.getAudioTracks().forEach(t => peer.addTrack(t, c.mic!));
      peer.ontrack = event => {
        if (!alive()) return;
        c.source?.disconnect();
        c.source = output.context.createMediaStreamSource(new MediaStream([event.track]));
        // Send streaming speech to Atlas. Only the avatar's synchronized return
        // track plays locally, so users do not hear two voices.
        c.source.connect(output.destination);
      };
      channel.onmessage = ({data}) => {
        if (!alive()) return;
        let event; try { event = JSON.parse(data); } catch { return; }
        if (event.type === "input_audio_buffer.speech_started") {setPartial("Listening…"); opts.current.thinking(false);}
        if (event.type === "input_audio_buffer.speech_stopped") {setPartial(""); opts.current.thinking(true);}
        if (event.type === "conversation.item.input_audio_transcription.completed") {
          setPartial(""); if (event.transcript?.trim()) opts.current.user(event.transcript.trim());
        }
        if (event.type === "response.created") { c.responding = true; opts.current.thinking(true); }
        if (event.type === "response.output_audio_transcript.delta") opts.current.thinking(false);
        if (event.type === "response.output_audio_transcript.done" && event.transcript?.trim()) opts.current.assistant(event.transcript.trim());
        if (event.type === "response.done") {
          c.responding = false; opts.current.thinking(false);
          if (event.response?.status === "failed") opts.current.error("Voice response failed. Please try again.");
        }
        if (event.type === "error") {opts.current.thinking(false); opts.current.error("Voice request failed. Please try again.");}
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
    if (c.responding) c.channel.send(JSON.stringify({type: "response.cancel"}));
    c.channel.send(JSON.stringify({type: "output_audio_buffer.clear"}));
    c.channel.send(JSON.stringify({type: "conversation.item.create", item: {type: "message", role: "user", content: [{type: "input_text", text}]}}));
    c.channel.send(JSON.stringify({type: "response.create"}));
  }, []);
  useEffect(() => stop, [stop]);
  return {start, stop, toggleMicrophone, sendText, isConnected, isListening, partialTranscript};
}
