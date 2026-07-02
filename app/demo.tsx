"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from "react";
import { useAtlasSession } from "@northmodellabs/atlas-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useScribe, CommitStrategy } from "@elevenlabs/react";

const DEFAULT_FACE_URL = "/faces/default.png";
const FACE_PRESETS = [
  { id: "default", label: "Default", src: DEFAULT_FACE_URL },
  { id: "reel-alt", label: "Reel", src: "/faces/reel-alt.png" },
];

type ChatMsg = {
  id: string;
  role: "user" | "atlas" | "system";
  text: string;
};

export type UiMode = "studio" | "tiktok" | "teacher" | "meet" | "mirror";
export type VoiceMode = "ai" | "mirror";

interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

const UI_MODES = new Set<UiMode>(["studio", "tiktok", "teacher", "meet", "mirror"]);
const UI_FORMATS: { id: UiMode; label: string; urlLabel: string }[] = [
  { id: "studio", label: "Studio", urlLabel: "Default URL mode" },
  { id: "tiktok", label: "TikTok", urlLabel: "?ui=tiktok" },
  { id: "teacher", label: "Teach", urlLabel: "?ui=teacher" },
  { id: "meet", label: "Meet", urlLabel: "?ui=meet" },
  { id: "mirror", label: "Mirror", urlLabel: "?ui=mirror" },
];
const VOICE_MODES: { id: VoiceMode; label: string; description: string }[] = [
  { id: "ai", label: "AI voice", description: "LLM + ElevenLabs speak through Atlas" },
  { id: "mirror", label: "Mirror", description: "Your microphone drives the avatar directly" },
];

let msgCounter = 0;

function getInitialUiMode(fallback: UiMode): UiMode {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const requestedUi = params.get("ui");
  if (!requestedUi && params.get("voice") === "mirror") return "mirror";
  return requestedUi && UI_MODES.has(requestedUi as UiMode) ? (requestedUi as UiMode) : fallback;
}

function getInitialVoiceMode(fallback: VoiceMode): VoiceMode {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  if (params.get("ui") === "mirror") return "mirror";
  const requestedVoice = params.get("voice");
  return requestedVoice === "mirror" ? "mirror" : fallback;
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 1a4 4 0 014 4v5a4 4 0 01-8 0V5a4 4 0 014-4z" />
      <path d="M19 10v1a7 7 0 01-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      {muted && <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />}
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H4" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h14" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function DemoPage({
  initialUiMode = "studio",
  initialVoiceMode = "ai",
}: {
  initialUiMode?: UiMode;
  initialVoiceMode?: VoiceMode;
}) {
  const session = useAtlasSession({
    autoEnableMic: false,
    createSession: async (face, faceUrl) => {
      let res: Response;
      if (face) {
        const form = new FormData();
        form.append("face", face);
        form.append("mode", "passthrough");
        res = await fetch("/api/session", { method: "POST", body: form });
      } else if (faceUrl) {
        res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ face_url: faceUrl, mode: "passthrough" }),
        });
      } else {
        throw new Error("No face image provided");
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to create session");
      return { sessionId: data.session_id, livekitUrl: data.livekit_url, token: data.token };
    },
    deleteSession: async (sessionId) => {
      try {
        const res = await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
        if (!res.ok) {
          console.warn(`[DELETE /api/session/${sessionId}] failed with ${res.status}`);
        }
      } catch (err) {
        console.warn(`[DELETE /api/session/${sessionId}] failed`, err);
      }
    },
  });

  const [sessionTime, setSessionTime] = useState(0);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState("default");
  const [faceUrl, setFaceUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [swapping, setSwapping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);

  const [configReady, setConfigReady] = useState<{ llm: boolean; tts: boolean } | null>(null);

  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [uiMode, setUiMode] = useState<UiMode>(() => getInitialUiMode(initialUiMode));
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => getInitialVoiceMode(initialVoiceMode));
  const [copied, setCopied] = useState(false);
  const [tiktokToolsOpen, setTiktokToolsOpen] = useState(false);
  const [meetLeaveArmed, setMeetLeaveArmed] = useState(false);
  const [mirrorInputActive, setMirrorInputActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const swapInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<ChatHistory[]>([]);
  const faceSelectionVersionRef = useRef(0);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfigReady(data))
      .catch(() => setConfigReady({ llm: false, tts: false }));
  }, []);

  const updateFormatMode = useCallback((nextMode: UiMode) => {
    if (nextMode === "mirror") {
      setUiMode("mirror");
      setVoiceMode("mirror");
      setTiktokToolsOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("ui", "mirror");
      url.searchParams.delete("voice");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }

    setVoiceMode("ai");
    setUiMode(nextMode);
    setTiktokToolsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("voice");
    if (nextMode === "studio") {
      url.searchParams.delete("ui");
    } else {
      url.searchParams.set("ui", nextMode);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const updateVoiceMode = useCallback((nextMode: VoiceMode) => {
    setVoiceMode(nextMode);
    const url = new URL(window.location.href);
    if (nextMode === "mirror") {
      setUiMode("mirror");
      setTiktokToolsOpen(false);
      url.searchParams.set("ui", "mirror");
      url.searchParams.delete("voice");
    } else {
      if (uiMode === "mirror") {
        setUiMode("studio");
        url.searchParams.delete("ui");
      }
      url.searchParams.delete("voice");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [uiMode]);

  useEffect(() => {
    setTiktokToolsOpen(false);
    setMeetLeaveArmed(false);
  }, [session.status]);

  useEffect(() => {
    setMeetLeaveArmed(false);
  }, [uiMode]);

  const addMsg = useCallback((role: ChatMsg["role"], text: string) => {
    setLocalMessages((prev) => [...prev, { id: `msg-${++msgCounter}`, role, text }]);
  }, []);

  const lastSyncedRef = useRef(0);
  useEffect(() => {
    const finals = session.messages.filter((m) => m.final);
    if (finals.length > lastSyncedRef.current) {
      const newMsgs = finals.slice(lastSyncedRef.current);
      for (const msg of newMsgs) {
        addMsg(msg.role === "user" ? "user" : "atlas", msg.text);
      }
      lastSyncedRef.current = finals.length;
    }
  }, [session.messages, addMsg]);

  useEffect(() => {
    if (session.status === "idle" || session.status === "disconnected") {
      lastSyncedRef.current = 0;
    }
  }, [session.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  useEffect(() => {
    if (session.status !== "connected") return;
    const interval = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session.status]);

  const isConnected = session.status === "connected";
  const isDisconnected = session.status === "idle" || session.status === "disconnected";

  const handleFile = useCallback((file: File, faceId = "custom", version?: number) => {
    if (!file.type.startsWith("image/")) return;
    const selectionVersion = version ?? faceSelectionVersionRef.current + 1;
    faceSelectionVersionRef.current = selectionVersion;
    setFaceFile(file);
    setSelectedFaceId(faceId);
    setFaceUrl("");
    const reader = new FileReader();
    reader.onload = (e) => {
      if (faceSelectionVersionRef.current === selectionVersion) {
        setFacePreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleSwapFace = useCallback(
    async (file: File, faceId = "custom") => {
      if (!session.sessionId || !file.type.startsWith("image/")) return false;
      setSwapping(true);
      try {
        const form = new FormData();
        form.append("face", file);
        const res = await fetch(`/api/session/${session.sessionId}`, {
          method: "PATCH",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json();
          addMsg("system", `Face swap failed: ${data.message || "Unknown error"}`);
          return false;
        } else {
          addMsg("system", "Face swapped");
          faceSelectionVersionRef.current += 1;
          setSelectedFaceId(faceId);
          const reader = new FileReader();
          reader.onload = (e) => setFacePreview(e.target?.result as string);
          reader.readAsDataURL(file);
          return true;
        }
      } catch {
        addMsg("system", "Face swap failed");
        return false;
      } finally {
        setSwapping(false);
        if (swapInputRef.current) swapInputRef.current.value = "";
      }
    },
    [session.sessionId, addMsg],
  );

  const selectPresetFace = useCallback(
    async (preset: (typeof FACE_PRESETS)[number]) => {
      const selectionVersion = faceSelectionVersionRef.current + 1;
      faceSelectionVersionRef.current = selectionVersion;
      setSelectedFaceId(preset.id);
      setFacePreview(preset.src);
      setFaceLoading(true);
      try {
        const res = await fetch(preset.src);
        const blob = await res.blob();
        const file = new File([blob], `${preset.id}.png`, { type: blob.type || "image/png" });
        if (faceSelectionVersionRef.current !== selectionVersion) return;
        if (isConnected) {
          await handleSwapFace(file, preset.id);
        } else {
          handleFile(file, preset.id, selectionVersion);
        }
      } catch {
        if (faceSelectionVersionRef.current === selectionVersion) {
          addMsg("system", "Could not load avatar");
        }
      } finally {
        if (faceSelectionVersionRef.current === selectionVersion) {
          setFaceLoading(false);
        }
      }
    },
    [addMsg, handleFile, handleSwapFace, isConnected],
  );

  const downloadCurrentFace = useCallback(() => {
    if (!facePreview) return;
    const link = document.createElement("a");
    link.href = facePreview;
    link.download = `atlas-avatar-${selectedFaceId || "image"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [facePreview, selectedFaceId]);

  useEffect(() => {
    fetch(DEFAULT_FACE_URL)
      .then((r) => r.blob())
      .then((blob) => {
        if (faceSelectionVersionRef.current !== 0) return;
        const file = new File([blob], "default-face.jpg", { type: "image/jpeg" });
        handleFile(file, "default");
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mirrorStreamRef = useRef<MediaStream | null>(null);
  const mirrorSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stopMirrorInput = useCallback(() => {
    try {
      mirrorSourceRef.current?.disconnect();
    } catch {
      /* best effort */
    }
    mirrorSourceRef.current = null;
    mirrorStreamRef.current?.getTracks().forEach((track) => track.stop());
    mirrorStreamRef.current = null;
    setMirrorInputActive(false);
  }, []);

  const startMirrorInput = useCallback(async () => {
    if (mirrorSourceRef.current) return;
    const audioCtx = audioCtxRef.current;
    const dest = destRef.current;
    if (!audioCtx || !dest) return;

    try {
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(dest);
      mirrorStreamRef.current = stream;
      mirrorSourceRef.current = source;
      setMirrorInputActive(true);
    } catch (err) {
      console.warn("Failed to start mirror microphone:", err);
      addMsg("system", "Mirror microphone could not start");
    }
  }, [addMsg]);

  useEffect(() => {
    if (session.status !== "connected" || !session.room) return;

    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const mediaTrack = dest.stream.getAudioTracks()[0];
    const lkTrack = new LocalAudioTrack(mediaTrack);

    audioCtxRef.current = audioCtx;
    destRef.current = dest;

    session.room.localParticipant.publishTrack(lkTrack, {
      name: "tts-audio",
      source: Track.Source.Unknown,
    }).catch((err) => console.warn("Failed to publish audio track:", err));

    return () => {
      ttsSourceRef.current?.stop();
      ttsSourceRef.current = null;
      stopMirrorInput();
      try { session.room?.localParticipant.unpublishTrack(lkTrack); } catch { /* best effort */ }
      lkTrack.stop();
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      destRef.current = null;
    };
  }, [session.status, session.room, stopMirrorInput]);

  const playTtsResponse = useCallback((base64Audio: string) => {
    const audioCtx = audioCtxRef.current;
    const dest = destRef.current;
    if (!audioCtx || !dest) return;

    ttsSourceRef.current?.stop();

    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    audioCtx.decodeAudioData(bytes.buffer.slice(0))
      .then((audioBuffer) => {
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(dest);
        ttsSourceRef.current = source;
        source.onended = () => {
          source.disconnect();
          ttsSourceRef.current = null;
        };
        source.start();
      })
      .catch((err) => console.warn("TTS playback failed:", err));
  }, []);

  const hasFace = !!faceFile || faceUrl.trim().startsWith("https://");
  const aiEnabled = voiceMode === "ai" && configReady?.llm === true;
  const connect = async () => {
    if (!hasFace) return;
    setLocalMessages([]);
    setSessionTime(0);
    chatHistoryRef.current = [];
    await session.connect(faceFile, faceUrl.trim() || null);
  };

  const disconnect = async () => {
    setMeetLeaveArmed(false);
    stopMirrorInput();
    stopListening();
    ttsSourceRef.current?.stop();
    ttsSourceRef.current = null;
    await session.disconnect();
    addMsg("system", "Session ended");
    setSessionTime(0);
    chatHistoryRef.current = [];
  };

  const armMeetLeave = () => {
    setMeetLeaveArmed(true);
    window.setTimeout(() => setMeetLeaveArmed(false), 2200);
  };

  const viewerUrl = session.sessionId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/watch/${session.sessionId}`
    : "";

  const copyShareLink = useCallback(async () => {
    if (!viewerUrl) return;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }, [viewerUrl]);

  const sendChatRef = useRef<(text: string) => void>(undefined);

  const sendChat = useCallback((text: string) => {
    sendChatRef.current?.(text);
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 0.8,
    languageCode: "en",
    onCommittedTranscript: (data) => {
      if (voiceMode !== "ai") return;
      if (data.text.trim()) sendChatRef.current?.(data.text.trim());
    },
  });

  const scribeRef = useRef(scribe);
  scribeRef.current = scribe;

  const startListening = useCallback(async () => {
    const s = scribeRef.current;
    if (s.isConnected || !aiEnabled || voiceMode !== "ai") return;
    try {
      const res = await fetch("/api/scribe-token");
      const { token } = await res.json();
      if (!token) return;
      await s.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.warn("Failed to start ElevenLabs STT:", err);
    }
  }, [aiEnabled, voiceMode]);

  const stopListening = useCallback(() => {
    scribeRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (session.status !== "connected") {
      stopMirrorInput();
      return;
    }

    if (voiceMode === "mirror") {
      stopListening();
      ttsSourceRef.current?.stop();
      ttsSourceRef.current = null;
      void startMirrorInput();
    } else {
      stopMirrorInput();
    }
  }, [session.status, voiceMode, startMirrorInput, stopMirrorInput, stopListening]);

  const toggleVoiceInput = useCallback(() => {
    if (voiceMode === "mirror") {
      if (mirrorInputActive) {
        stopMirrorInput();
      } else {
        void startMirrorInput();
      }
      return;
    }
    if (scribeRef.current.isConnected) {
      stopListening();
    } else {
      void startListening();
    }
  }, [mirrorInputActive, startListening, startMirrorInput, stopListening, stopMirrorInput, voiceMode]);

  sendChatRef.current = (text: string) => {
    if (!text.trim()) return;
    addMsg("user", text);

    if (voiceMode === "mirror") {
      return;
    }

    if (aiEnabled) {
      setAiThinking(true);
      chatHistoryRef.current.push({ role: "user", content: text });

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history: chatHistoryRef.current.slice(0, -1) }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("AI request failed");
          return res.json();
        })
        .then((data) => {
          setAiThinking(false);
          if (data.text) {
            addMsg("atlas", data.text);
            chatHistoryRef.current.push({ role: "assistant", content: data.text });

            fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: data.text }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((tts) => {
                if (tts?.audio) playTtsResponse(tts.audio);
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          addMsg("system", "Failed to reach AI");
          setAiThinking(false);
        });
    } else {
      session.sendChat(text);
    }
  };

  // Auto-start listening when connected + AI enabled
  useEffect(() => {
    if (session.status === "connected" && aiEnabled && voiceMode === "ai") {
      startListening();
    }
    return () => { stopListening(); };
  }, [session.status, aiEnabled, voiceMode, startListening, stopListening]);

  const isTiktokUi = uiMode === "tiktok";
  const overlayMessages = localMessages.filter((msg) => msg.role !== "system").slice(-2);
  const latestAtlasMessage = [...localMessages].reverse().find((msg) => msg.role === "atlas");
  const voiceInputActive = voiceMode === "mirror" ? mirrorInputActive : scribe.isConnected;
  const activeFormatMode: UiMode = uiMode;
  const formatPicker = (className = "") => (
    <div className={`format-picker ${className}`}>
      {UI_FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          onClick={() => updateFormatMode(format.id)}
          className={activeFormatMode === format.id ? "is-active" : ""}
          aria-label={format.id === "mirror" ? "Switch to mirror voice mode" : `Switch to ${format.label} UI`}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
  const voiceModePicker = (className = "") => (
    <div className={`voice-mode-picker ${className}`}>
      {VOICE_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => updateVoiceMode(mode.id)}
          className={voiceMode === mode.id ? "is-active" : ""}
          aria-label={`Use ${mode.label}`}
          title={mode.description}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
  const hiddenFaceInputs = (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      <input
        ref={swapInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSwapFace(file);
        }}
        className="hidden"
      />
    </>
  );

  if (uiMode === "teacher") {
    return (
      <div className="teacher-ui min-h-screen w-screen bg-[#edf1f5] text-[#111827]">
        {hiddenFaceInputs}
        {formatPicker("global-format-picker")}
        <header className="teacher-topbar">
          <div>
            <h1>Visual calculus</h1>
          </div>
        </header>

        <main className="teacher-shell">
          <section className="teacher-board">
            <div className="teacher-canvas">
              <div className="teacher-axis teacher-axis-x" />
              <div className="teacher-axis teacher-axis-y" />
              <span className="teacher-axis-label teacher-axis-label-x">x</span>
              <span className="teacher-axis-label teacher-axis-label-y">y</span>
              <svg className="teacher-curve" viewBox="0 0 720 420" aria-hidden="true">
                <path d="M38 318 C160 188 226 355 338 214 C424 104 486 92 590 145 C642 170 668 202 694 238" />
                <circle cx="338" cy="214" r="6" />
                <circle cx="590" cy="145" r="6" />
              </svg>
              <div className="teacher-equation teacher-equation-main">
                <span aria-label="f of x equals x squared minus 4 x plus 3">
                  f(x) = x<sup>2</sup> - 4x + 3
                </span>
              </div>
              <div className="teacher-equation teacher-equation-note">
                <span aria-label="f prime of x equals 2 x minus 4">
                  derivative: f&apos;(x) = 2x - 4
                </span>
              </div>
            </div>
            <div className="teacher-problem-row">
              <div className="is-active">
                <span>Step 1</span>
                Notice the curve
              </div>
              <div>
                <span>Step 2</span>
                Locate the flat point
              </div>
              <div>
                <span>Step 3</span>
                Explain the derivative
              </div>
            </div>
          </section>

          <aside className="teacher-avatar-panel">
            <div className="teacher-avatar-frame">
              <div
                ref={session.videoRef}
                className="teacher-video"
                style={{ display: isConnected ? "flex" : "none" }}
              />
              {!isConnected && (
                <div className="teacher-face-preview">
                  {facePreview ? (
                    <Image src={facePreview} alt="" width={420} height={420} unoptimized />
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Choose face">
                      <UploadIcon />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="teacher-avatar-copy">
              <span>{voiceMode === "mirror" ? "Mirror voice" : isConnected ? "Live tutor" : "Tutor preview"}</span>
              <h2>{voiceMode === "mirror" ? "Speak through Atlas" : "Ask Atlas"}</h2>
              <p>
                {voiceMode === "mirror"
                  ? mirrorInputActive
                    ? "Your microphone is driving the avatar directly."
                    : "Call the avatar, then allow mic access to mirror your voice."
                  : isConnected
                    ? latestAtlasMessage?.text || "Ask about any step on the board."
                    : "Start a short guided explanation, or ask a question about the graph."}
              </p>
            </div>
            {voiceModePicker("teacher-voice-picker")}
            <div className="teacher-avatar-strip">
              {FACE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void selectPresetFace(preset)}
                  className={selectedFaceId === preset.id ? "is-selected" : ""}
                  aria-label={`Use ${preset.label} avatar`}
                >
                  <Image src={preset.src} alt="" width={96} height={96} unoptimized />
                </button>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload avatar">
                <UploadIcon />
              </button>
            </div>
            <div className="teacher-actions">
              <button
                type="button"
                onClick={() => (isConnected ? void disconnect() : hasFace ? void connect() : undefined)}
                disabled={!isConnected && !hasFace}
                className={isConnected ? "is-danger" : "is-primary"}
              >
                {isConnected ? "End call" : "Call avatar"}
              </button>
              <button type="button" onClick={downloadCurrentFace} disabled={!facePreview}>
                <DownloadIcon /> Image
              </button>
            </div>
            {voiceMode === "ai" ? (
              <form
                className="teacher-prompt"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim() && !aiThinking) {
                    sendChat(chatInput.trim());
                    setChatInput("");
                  }
                }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about the board..."
                  disabled={aiThinking}
                />
                <button type="submit" disabled={!chatInput.trim() || aiThinking}>
                  Send
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={!isConnected}
                className={`teacher-mirror-button ${mirrorInputActive ? "is-live" : ""}`}
              >
                <MicIcon muted={!mirrorInputActive} />
                {mirrorInputActive ? "Mirror live" : isConnected ? "Start mirror" : "Call avatar first"}
              </button>
            )}
          </aside>
        </main>
      </div>
    );
  }

  if (uiMode === "meet") {
    return (
      <div className="meet-ui h-screen w-screen overflow-hidden bg-[#202124] text-white">
        {hiddenFaceInputs}
        {formatPicker("global-format-picker meet-global-format-picker")}
        {voiceModePicker("meet-voice-picker")}
        <header className="meet-topbar">
          <div>
            <strong>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
            <span>atlas-demo</span>
            <span className="meet-info-dot">i</span>
          </div>
          <div className="meet-room-pill">
            <span>{selectedFaceId.slice(0, 1).toUpperCase()}</span>
            <strong>1</strong>
          </div>
        </header>

        <main className="meet-stage">
          <section className="meet-main-tile">
            <div
              ref={session.videoRef}
              className="meet-video"
              style={{ display: isConnected ? "flex" : "none" }}
            />
            {!isConnected && (
              <div className="meet-face-preview">
                {facePreview ? (
                  <Image src={facePreview} alt="" width={960} height={960} unoptimized />
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Choose avatar">
                    <UploadIcon />
                  </button>
                )}
              </div>
            )}
            <div className="meet-avatar-status">
              <strong>Atlas Realtime</strong>
              <span>{isConnected ? `${formatTime(sessionTime)} · connected` : "Waiting in lobby"}</span>
            </div>
            <div className="meet-floating-caption">
              {voiceMode === "mirror"
                ? mirrorInputActive
                  ? "Mirror is live. Speak normally and Atlas will carry your voice."
                  : "Start the call, then enable mirror mic."
                : latestAtlasMessage?.text || "Ready when you are. Start the call to talk with Atlas."}
            </div>
          </section>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="meet-self-chip"
            aria-label="Choose avatar"
            title="Choose avatar"
          >
            {facePreview ? <Image src={facePreview} alt="" width={80} height={80} unoptimized /> : <UploadIcon />}
          </button>
        </main>

        <div className="meet-bottom-bar">
          <button type="button" aria-label="More call actions" title="More">
            ...
          </button>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={voiceInputActive ? "is-live" : ""}
            aria-label={voiceInputActive ? "Mute microphone" : "Start microphone"}
            title={voiceMode === "mirror" ? "Mirror microphone" : "AI microphone"}
          >
            <MicIcon muted={!voiceInputActive} />
          </button>
          <button
            type="button"
            aria-label="Avatar video"
            title="Avatar video"
          >
            <VolumeIcon />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change avatar"
            title="Change avatar"
          >
            {facePreview ? <Image src={facePreview} alt="" width={64} height={64} unoptimized /> : <UploadIcon />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isConnected) {
                if (hasFace) void connect();
                return;
              }
              if (meetLeaveArmed) {
                void disconnect();
              } else {
                armMeetLeave();
              }
            }}
            disabled={!isConnected && !hasFace}
            className={isConnected ? `is-danger ${meetLeaveArmed ? "is-armed" : ""}` : "is-call"}
            aria-label={isConnected ? (meetLeaveArmed ? "Confirm leave call" : "Arm leave call") : "Join call"}
            title={isConnected ? (meetLeaveArmed ? "Click again to leave" : "Click once more to leave") : "Join call"}
          >
            {isConnected ? <StopIcon /> : <PlayIcon />}
          </button>
          <button type="button" onClick={downloadCurrentFace} disabled={!facePreview} aria-label="Download image">
            <DownloadIcon />
          </button>
        </div>

        <div className="meet-corner-controls">
          <button type="button" aria-label="Open chat" title="Chat">
            <CopyIcon />
          </button>
          <button type="button" onClick={() => setVisibility((value) => value === "private" ? "public" : "private")} aria-label="Toggle visibility" title="Visibility">
            {visibility === "public" ? <GlobeIcon /> : <LockIcon />}
          </button>
        </div>

      </div>
    );
  }

  if (uiMode === "mirror") {
    return (
      <div className="mirror-ui min-h-screen w-screen overflow-hidden bg-[#f7f7f4] text-[#111111]">
        {hiddenFaceInputs}
        {formatPicker("global-format-picker mirror-format-picker")}

        <main className="mirror-shell">
          <section className="mirror-stage">
            <div className={`mirror-card ${mirrorInputActive ? "is-expanded" : ""}`}>
              <div className="mirror-video-wrap">
                <div
                  ref={session.videoRef}
                  className="mirror-video"
                  style={{ display: isConnected ? "flex" : "none" }}
                />
                {!isConnected && (
                  <div className="mirror-face-hold">
                    {facePreview ? (
                      <Image src={facePreview} alt="" width={420} height={420} unoptimized />
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Choose avatar">
                        <UploadIcon />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={`mirror-signal ${mirrorInputActive ? "is-live" : ""}`} aria-hidden="true">
                <span />
              </div>

              <div className="mirror-status-row">
                <span>{isConnected ? "Connected" : session.status === "connecting" ? "Connecting" : "Ready"}</span>
                <strong>
                  {mirrorInputActive
                    ? "Mirror mic live"
                    : isConnected
                      ? "Mic is muted"
                      : "Ready to start"}
                </strong>
                {isConnected && <span>{formatTime(sessionTime)}</span>}
              </div>
            </div>
          </section>

          <aside className="mirror-control-dock" aria-label="Mirror controls">
            <div className="mirror-avatar-row">
              {FACE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void selectPresetFace(preset)}
                  className={selectedFaceId === preset.id ? "is-selected" : ""}
                  aria-label={`Use ${preset.label} avatar`}
                  title={preset.label}
                >
                  <Image src={preset.src} alt="" width={72} height={72} unoptimized />
                </button>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload avatar" title="Upload avatar">
                <UploadIcon />
              </button>
              <button type="button" onClick={downloadCurrentFace} disabled={!facePreview} aria-label="Download avatar" title="Download avatar">
                <DownloadIcon />
              </button>
            </div>

            <div className="mirror-main-actions">
              <button
                type="button"
                onClick={() => (isConnected ? void disconnect() : hasFace ? void connect() : undefined)}
                disabled={!isConnected && !hasFace}
                className={isConnected ? "is-danger" : "is-primary"}
              >
                {isConnected ? <StopIcon /> : <PlayIcon />}
                {isConnected ? "End" : "Start"}
              </button>
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={!isConnected}
                className={mirrorInputActive ? "is-live" : ""}
              >
                <MicIcon muted={!mirrorInputActive} />
                {mirrorInputActive ? "Mute mirror" : "Mirror mic"}
              </button>
            </div>

          </aside>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden bg-[#050505] font-sans ${
        isTiktokUi ? "tiktok-ui relative" : "flex"
      }`}
    >
      {formatPicker("global-format-picker")}
      {/* Video Panel */}
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-black ${
          isTiktokUi ? "tiktok-reel" : "flex-1"
        }`}
      >
        <div
          ref={session.videoRef}
          className={`w-full h-full mx-auto flex items-center justify-center ${
            isTiktokUi ? "max-w-none max-h-none" : "max-w-[512px] max-h-[512px]"
          }`}
          style={{ display: isConnected ? "flex" : "none" }}
        />

        {!isConnected && (
          isTiktokUi ? (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              {facePreview && (
                <Image
                  src={facePreview}
                  alt=""
                  width={640}
                  height={960}
                  unoptimized
                  className="h-full w-full scale-110 object-cover opacity-45 blur-xl"
                />
              )}
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute flex flex-col items-center gap-4 px-10 text-center">
                {facePreview ? (
                <Image
                  src={facePreview}
                  alt=""
                  width={112}
                  height={112}
                  unoptimized
                  className="tiktok-face-photo h-28 w-28 object-cover ring-2 ring-white/80"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="tiktok-action-button tiktok-face-picker"
                  aria-label="Choose face"
                >
                    <UploadIcon />
                  </button>
                )}
                <div className="tiktok-caption text-[24px] font-bold leading-tight text-white">
                  Atlas Realtime
                </div>
                <div className="tiktok-caption text-[14px] leading-snug text-white/70">
                  {hasFace ? "Tap start to go live" : "Choose a face to start"}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-breathe">
              <svg width="180" height="220" viewBox="0 0 180 220" fill="none" className="text-[#e0e0e0]">
                <circle cx="90" cy="72" r="36" stroke="currentColor" strokeWidth="1" />
                <path d="M30 200c0-33.137 26.863-60 60-60s60 26.863 60 60" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
          )
        )}

        {!isTiktokUi && (
        <div className="absolute bottom-6 left-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.25em] uppercase select-none z-10">
          {isConnected ? (
            <>
              <span className="w-1.5 h-1.5 bg-accent animate-pulse-glow" />
              <span className="text-accent">Live</span>
              {visibility === "public" && (
                <span className="text-accent/60 ml-2 flex items-center gap-1"><GlobeIcon /> Public</span>
              )}
              <span className="text-muted ml-2">{formatTime(sessionTime)}</span>
              {session.latency > 0 && (
                <span className="text-[#666] ml-2">{session.latency}ms</span>
              )}
            </>
          ) : session.status === "connecting" ? (
            <>
              <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
              <span className="text-muted">Connecting</span>
            </>
          ) : session.error ? (
            <span className="text-[#ff3333]">Connection Failed</span>
          ) : (
            <span className="text-[#555]">Disconnected</span>
          )}
        </div>
        )}

        {isTiktokUi && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <input
              ref={swapInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSwapFace(file);
              }}
              className="hidden"
            />

            {!isConnected && (
              <div className="tiktok-avatar-strip absolute inset-x-4 top-4 z-30 flex gap-3 overflow-x-auto px-1 pb-2">
                {FACE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void selectPresetFace(preset)}
                    className={`tiktok-avatar-chip shrink-0 ${selectedFaceId === preset.id ? "is-selected" : ""} ${
                      faceLoading && selectedFaceId === preset.id ? "is-loading" : ""
                    }`}
                    aria-label={`Use ${preset.label} avatar`}
                    title={preset.label}
                  >
                    <Image src={preset.src} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`tiktok-avatar-chip shrink-0 ${selectedFaceId === "custom" ? "is-selected" : ""}`}
                  aria-label="Upload avatar"
                  title="Upload"
                >
                  {selectedFaceId === "custom" && facePreview ? (
                    <Image src={facePreview} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <UploadIcon />
                  )}
                </button>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-5 bottom-32 z-20 flex flex-col items-start gap-2">
              {isConnected && overlayMessages.length === 0 && !scribe.partialTranscript && !aiThinking && (
                <div className="tiktok-caption text-[20px] font-semibold leading-tight text-white/80">
                  {voiceMode === "mirror"
                    ? mirrorInputActive
                      ? "Mirror live"
                      : "Tap mic to mirror"
                    : aiEnabled && scribe.isConnected
                      ? "Listening..."
                      : "Type or speak to start"}
                </div>
              )}
              {overlayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`tiktok-caption max-w-[min(420px,calc(100vw-7rem))] text-[22px] font-semibold leading-tight ${
                    msg.role === "atlas"
                      ? "text-white"
                      : "text-white/90"
                  }`}
                >
                  <span
                    className="tiktok-speaker mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/58"
                  >
                    {msg.role === "atlas" ? "Atlas" : "You"}
                  </span>
                  {msg.text}
                </div>
              ))}
              {scribe.partialTranscript && (
                <div className="tiktok-caption max-w-[min(420px,calc(100vw-7rem))] text-[22px] font-semibold italic leading-tight text-white/75">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                    You
                  </span>
                  {scribe.partialTranscript}...
                </div>
              )}
              {aiThinking && (
                <div className="tiktok-caption text-[22px] font-semibold leading-tight text-white">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-7 left-5 z-30 flex max-w-[calc(100%-7rem)] flex-col gap-1 text-white">
              <span className="tiktok-caption text-[15px] font-semibold">
                Atlas Realtime
              </span>
              <span className="tiktok-caption text-[12px] text-white/75">
                {isConnected
                  ? `${visibility === "public" ? "Public" : "Private"} · ${formatTime(sessionTime)}`
                  : session.status === "connecting"
                    ? "Connecting..."
                    : "Ready to connect"}
              </span>
            </div>

            <div className="absolute bottom-24 right-4 z-30 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (isConnected) {
                    void disconnect();
                  } else if (hasFace) {
                    void connect();
                  }
                }}
                disabled={!isConnected && !hasFace}
                className={`tiktok-action-button ${isConnected ? "tiktok-action-danger" : "tiktok-action-primary"}`}
                aria-label={isConnected ? "Disconnect" : "Connect"}
                title={isConnected ? "Disconnect" : "Connect"}
              >
                {isConnected ? <StopIcon /> : <PlayIcon />}
              </button>
              <span className="tiktok-action-label">
                {isConnected ? "End" : "Start"}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (isConnected) {
                    swapInputRef.current?.click();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="tiktok-action-button tiktok-action-face overflow-hidden"
                aria-label={isConnected ? "Swap face" : "Choose face"}
                title={isConnected ? "Swap face" : "Choose face"}
              >
                {facePreview ? (
                  <Image src={facePreview} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <UploadIcon />
                )}
              </button>
              <span className="tiktok-action-label">
                {isConnected ? (swapping ? "Swap..." : "Swap") : "Face"}
              </span>

              <button
                type="button"
                onClick={downloadCurrentFace}
                disabled={!facePreview}
                className="tiktok-action-button tiktok-action-download"
                aria-label="Download avatar image"
                title="Download avatar image"
              >
                <DownloadIcon />
              </button>
              <span className="tiktok-action-label">Image</span>

              {isConnected && (
                <>
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`tiktok-action-button ${voiceInputActive ? "tiktok-action-live" : ""}`}
                    aria-label={voiceInputActive ? "Mute microphone" : "Start microphone"}
                    title={voiceMode === "mirror" ? "Mirror microphone" : "AI microphone"}
                  >
                    <MicIcon muted={!voiceInputActive} />
                  </button>
                  <span className="tiktok-action-label">
                    {voiceMode === "mirror" ? (mirrorInputActive ? "Mirror" : "Mic") : voiceInputActive ? "Live" : "Mic"}
                  </span>
                </>
              )}

              {!isConnected && (
                <>
                  <button
                    type="button"
                    onClick={() => setVisibility((value) => value === "private" ? "public" : "private")}
                    className={`tiktok-action-button ${visibility === "public" ? "tiktok-action-live" : ""}`}
                    aria-label="Toggle visibility"
                    title="Toggle visibility"
                  >
                    {visibility === "public" ? <GlobeIcon /> : <LockIcon />}
                  </button>
                  <span className="tiktok-action-label">
                    {visibility === "public" ? "Public" : "Private"}
                  </span>
                </>
              )}

              <button
                type="button"
                onClick={() => setTiktokToolsOpen((open) => !open)}
                className={`tiktok-action-button tiktok-action-studio ${tiktokToolsOpen ? "tiktok-action-live" : ""}`}
                aria-label="Open avatar tools"
                title="Avatar tools"
              >
                <StudioIcon />
              </button>
              <span className="tiktok-action-label">Tools</span>

              {tiktokToolsOpen && (
                <div className="tiktok-tools-menu absolute bottom-0 right-16 flex flex-col gap-2 p-2">
                  <div className="tiktok-tools-voice">
                    {VOICE_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateVoiceMode(mode.id)}
                        className={voiceMode === mode.id ? "is-selected" : ""}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  {FACE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        void selectPresetFace(preset);
                        setTiktokToolsOpen(false);
                      }}
                      className={`tiktok-tools-item ${selectedFaceId === preset.id ? "is-selected" : ""}`}
                      aria-label={`Use ${preset.label} avatar`}
                      title={preset.label}
                    >
                      <Image src={preset.src} alt="" width={36} height={36} className="h-9 w-9 object-cover" unoptimized />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setTiktokToolsOpen(false);
                    }}
                    className={`tiktok-tools-item ${selectedFaceId === "custom" ? "is-selected" : ""}`}
                    aria-label="Upload avatar"
                    title="Upload avatar"
                  >
                    <span className="tiktok-tools-icon"><UploadIcon /></span>
                    <span>Upload</span>
                  </button>
                </div>
              )}
            </div>

            {isConnected && voiceMode === "ai" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim() && !aiThinking) {
                    sendChat(chatInput.trim());
                    setChatInput("");
                  }
                }}
                className="absolute bottom-7 right-5 z-30 flex w-[min(320px,calc(100%-7rem))] gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={aiEnabled ? "Ask something..." : "Type a message..."}
                  disabled={aiThinking}
                  className="tiktok-composer-input min-w-0 flex-1 px-4 py-3 text-[13px] text-white placeholder-white/45 outline-none transition-all duration-200 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || aiThinking}
                  className="tiktok-send-button px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-all duration-200 disabled:text-white/30"
                >
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Transcript Panel */}
      {isConnected && !isTiktokUi && (
        <div className="w-[300px] border-l border-border bg-panel flex flex-col">
          <div className="px-4 h-14 flex items-center border-b border-border shrink-0">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
              Transcript
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll px-4 py-3 space-y-3">
            {localMessages.length === 0 && (
              <p className="font-mono text-[10px] text-[#666] text-center mt-8">
                {voiceMode === "mirror"
                  ? mirrorInputActive
                    ? "Mirror is live — speak normally..."
                    : "Enable the mirror mic to speak through Atlas..."
                  : aiEnabled
                  ? scribe.isConnected
                    ? "Listening — speak or type below..."
                    : "Type a message to start..."
                  : "Start speaking..."}
              </p>
            )}
            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : msg.role === "system" ? "items-center" : "items-start"
                }`}
              >
                {msg.role === "system" ? (
                  <span className="font-mono text-[9px] text-[#555] py-1">{msg.text}</span>
                ) : (
                  <>
                    <span className="font-mono text-[9px] tracking-[0.15em] text-[#888] uppercase mb-1">
                      {msg.role === "user" ? "You" : "Atlas"}
                    </span>
                    <div
                      className={`px-3 py-2 max-w-[240px] text-[12px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#151515] border border-[#333] text-[#ccc]"
                          : "bg-[#0a1a0f] border border-[#1a3a20] text-accent"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </>
                )}
              </div>
            ))}
            {scribe.partialTranscript && (
              <div className="flex flex-col items-end">
                <span className="font-mono text-[9px] tracking-[0.15em] text-[#888] uppercase mb-1">
                  You
                </span>
                <div className="px-3 py-2 bg-[#151515] border border-[#333] text-[#666] text-[12px] italic">
                  {scribe.partialTranscript}...
                </div>
              </div>
            )}
            {aiThinking && (
              <div className="flex flex-col items-start">
                <span className="font-mono text-[9px] tracking-[0.15em] text-[#888] uppercase mb-1">
                  Atlas
                </span>
                <div className="px-3 py-2 bg-[#0a1a0f] border border-[#1a3a20] text-accent text-[12px]">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-3 border-t border-border shrink-0">
            {voiceMode === "ai" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim() && !aiThinking) {
                    sendChat(chatInput.trim());
                    setChatInput("");
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={aiEnabled ? "Ask something..." : "Type a message..."}
                  disabled={aiThinking}
                  className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-[12px] text-foreground placeholder-[#555] font-sans focus:outline-none focus:border-accent transition-all duration-200 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || aiThinking}
                  className="px-3 py-2 border border-accent text-accent font-mono text-[10px] tracking-[0.1em] uppercase hover:bg-accent hover:text-[#050505] transition-all duration-200 disabled:border-[#333] disabled:text-[#555] disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={!isConnected}
                className={`w-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-all duration-200 ${
                  mirrorInputActive
                    ? "border-accent text-accent"
                    : "border-[#333] text-[#888] hover:border-accent hover:text-accent"
                } disabled:opacity-40`}
              >
                {mirrorInputActive ? "Mirror mic live" : isConnected ? "Start mirror mic" : "Connect to mirror voice"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Control Panel */}
      {!isTiktokUi && (
      <div className="w-[320px] border-l border-border bg-panel flex flex-col panel-glow-border">
        <div className="px-6 h-14 flex items-center border-b border-border shrink-0">
          <span className="font-mono text-[11px] tracking-[0.3em] text-foreground uppercase font-semibold">
            ✦
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll">
          {/* AI Status Banner */}
          {configReady && voiceMode === "ai" && (
            <div className={`px-6 py-3 border-b ${!configReady.llm || !configReady.tts ? "border-[#3a2a00] bg-[#1a1400]" : "border-[#0a3a15] bg-[#0a1a0f]"}`}>
              {!configReady.llm || !configReady.tts ? (
                <div className="flex items-start gap-2">
                  <span className="text-[#ffaa00] mt-0.5 shrink-0"><WarningIcon /></span>
                  <div>
                    <p className="font-mono text-[10px] text-[#ffaa00] tracking-[0.1em]">
                      {!configReady.llm && !configReady.tts
                        ? "LLM + TTS not configured"
                        : !configReady.llm
                          ? "LLM not configured"
                          : "TTS not configured"}
                    </p>
                    <p className="font-mono text-[9px] text-[#886600] mt-1 leading-relaxed">
                      Add {!configReady.llm && <code className="text-[#aa8800]">LLM_API_KEY</code>}
                      {!configReady.llm && !configReady.tts && " and "}
                      {!configReady.tts && <code className="text-[#aa8800]">ELEVENLABS_API_KEY</code>}
                      {" "}to .env.local to enable AI responses
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent" />
                  <p className="font-mono text-[10px] text-accent tracking-[0.1em]">
                    LLM + TTS enabled
                  </p>
                </div>
              )}
            </div>
          )}
          {voiceMode === "mirror" && (
            <div className="px-6 py-3 border-b border-[#0a3a15] bg-[#0a1a0f]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent" />
                <p className="font-mono text-[10px] text-accent tracking-[0.1em]">
                  Mirror voice enabled
                </p>
              </div>
              <p className="font-mono text-[9px] text-[#5f8f72] mt-1 leading-relaxed">
                Your mic is routed directly into the avatar. LLM and ElevenLabs are bypassed.
              </p>
            </div>
          )}

          {/* Face Upload */}
          <div className="px-6 py-5 border-b border-border">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
              Face
            </label>
            {facePreview ? (
              <div className="flex items-center gap-3">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => {
                    if (isConnected) {
                      swapInputRef.current?.click();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Image src={facePreview} alt="Face preview" width={64} height={64} className="w-16 h-16 object-cover border border-accent" unoptimized />
                  <div className="absolute inset-0 w-16 h-16 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                    <span className="font-mono text-[9px] tracking-[0.15em] text-foreground uppercase">
                      {isConnected ? "Swap" : "Change"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-accent tracking-[0.1em]">Ready</span>
                  {isConnected && (
                    <button
                      onClick={() => swapInputRef.current?.click()}
                      disabled={swapping}
                      className="flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-muted hover:text-accent transition-colors disabled:opacity-50"
                    >
                      <SwapIcon />
                      {swapping ? "Swapping..." : "Swap face"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`border border-dashed py-8 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-accent shadow-[0_0_20px_rgba(0,255,136,0.1)] text-accent"
                    : "border-border text-muted hover:border-[#333] hover:text-[#777]"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <UploadIcon />
                <span className="font-mono text-[10px] tracking-[0.1em]">Drop face photo</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <input
              ref={swapInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSwapFace(file);
              }}
              className="hidden"
            />

            {!faceFile && !isConnected && (
              <div className="mt-3">
                <input
                  type="url"
                  value={faceUrl}
                  onChange={(e) => setFaceUrl(e.target.value)}
                  placeholder="Or paste HTTPS image URL"
                  className={`w-full bg-[#0a0a0a] border px-3 py-2 text-[11px] text-foreground placeholder-[#555] font-mono focus:outline-none transition-all duration-200 ${
                    faceUrl.trim() && !faceUrl.trim().startsWith("https://")
                      ? "border-[#ff3333]"
                      : faceUrl.trim().startsWith("https://")
                        ? "border-accent"
                        : "border-border focus:border-accent"
                  }`}
                />
                {faceUrl.trim() && !faceUrl.trim().startsWith("https://") && (
                  <p className="font-mono text-[9px] text-[#ff3333] mt-1">Must be a valid HTTPS URL</p>
                )}
                {!faceUrl.trim() && (
                  <p className="font-mono text-[9px] text-[#555] mt-1">Drop an image or paste a URL</p>
                )}
              </div>
            )}
          </div>

          {/* Mode label */}
          <div className="px-6 py-5 border-b border-border">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
              Voice
            </label>
            <div className="grid grid-cols-2 border border-border">
              {VOICE_MODES.map((mode, index) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateVoiceMode(mode.id)}
                  className={`py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-200 ${
                    index > 0 ? "border-l border-border" : ""
                  } ${
                    voiceMode === mode.id
                      ? "bg-[#050505] text-accent shadow-[inset_0_0_20px_rgba(0,255,136,0.06),0_0_12px_rgba(0,255,136,0.1)]"
                      : "text-[#555] hover:text-[#888]"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[9px] text-[#555] mt-2">
              {VOICE_MODES.find((mode) => mode.id === voiceMode)?.description}
            </p>
          </div>

          {/* UI format */}
          <div className="px-6 py-5 border-b border-border">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
              UI Format
            </label>
            <div className="grid grid-cols-2 border border-border">
              {UI_FORMATS.map((format, index) => (
                <button
                  key={format.id}
                  onClick={() => updateFormatMode(format.id)}
                  className={`py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-200 ${
                    index % 2 === 1 ? "border-l border-border" : ""
                  } ${
                    index > 1 ? "border-t border-border" : ""
                  } ${
                    activeFormatMode === format.id
                      ? "bg-[#050505] text-accent shadow-[inset_0_0_20px_rgba(0,255,136,0.06),0_0_12px_rgba(0,255,136,0.1)]"
                      : "text-[#555] hover:text-[#888]"
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[9px] text-[#555] mt-2">
              {UI_FORMATS.find((format) => format.id === activeFormatMode)?.urlLabel}
            </p>
          </div>

          {/* Visibility toggle */}
          <div className="px-6 py-5 border-b border-border">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
              Visibility
            </label>
            <div className="flex border border-border">
              <button
                onClick={() => !isConnected && setVisibility("private")}
                disabled={isConnected}
                className={`flex-1 py-2.5 font-mono text-[10px] tracking-[0.2em] uppercase text-center transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  visibility === "private"
                    ? "bg-[#050505] text-accent shadow-[inset_0_0_20px_rgba(0,255,136,0.06),0_0_12px_rgba(0,255,136,0.1)]"
                    : "text-[#555] hover:text-[#888]"
                } disabled:cursor-not-allowed`}
              >
                <LockIcon /> Private
              </button>
              <button
                onClick={() => !isConnected && setVisibility("public")}
                disabled={isConnected}
                className={`flex-1 py-2.5 font-mono text-[10px] tracking-[0.2em] uppercase text-center transition-all duration-200 flex items-center justify-center gap-1.5 border-l border-border ${
                  visibility === "public"
                    ? "bg-[#050505] text-accent shadow-[inset_0_0_20px_rgba(0,255,136,0.06),0_0_12px_rgba(0,255,136,0.1)]"
                    : "text-[#555] hover:text-[#888]"
                } disabled:cursor-not-allowed`}
              >
                <GlobeIcon /> Public
              </button>
            </div>
            <p className="font-mono text-[9px] text-[#555] mt-2">
              {visibility === "private"
                ? "Only you can see this session"
                : "Anyone with the link can watch (view-only)"}
            </p>
          </div>

          {/* Share link (public + connected only) */}
          {isConnected && visibility === "public" && session.sessionId && (
            <div className="px-6 py-5 border-b border-border">
              <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
                <span className="flex items-center gap-1.5"><ShareIcon /> Share</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={viewerUrl}
                  readOnly
                  className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-[10px] text-[#888] font-mono focus:outline-none select-all truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyShareLink}
                  className={`px-3 py-2 border font-mono text-[10px] tracking-[0.1em] uppercase transition-all duration-200 flex items-center gap-1 ${
                    copied
                      ? "border-accent text-accent"
                      : "border-[#444] text-[#888] hover:border-accent hover:text-accent"
                  }`}
                >
                  {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
              </div>
              <p className="font-mono text-[9px] text-[#555] mt-2">
                Viewers can watch the avatar stream — no mic, no publishing
              </p>
            </div>
          )}

          {/* Connection Controls */}
          <div className="px-6 py-5 space-y-6">
            {isDisconnected && !session.error && (
              <>
                {!hasFace && (
                  <p className="font-mono text-[9px] text-[#666] leading-relaxed">
                    Drop a face photo or paste an HTTPS URL above to connect.
                  </p>
                )}
                <button
                  onClick={connect}
                  disabled={!hasFace}
                  className={`w-full py-3 font-mono text-[10px] tracking-[0.2em] uppercase border transition-all duration-200 ${
                    hasFace
                      ? "border-accent text-accent hover:bg-accent hover:text-[#050505]"
                      : "border-[#333] text-[#555] cursor-not-allowed"
                  }`}
                >
                  Connect
                </button>
              </>
            )}

            {session.status === "connecting" && (
              <div className="text-center font-mono text-[10px] text-muted tracking-[0.15em] uppercase py-3">
                Connecting...
              </div>
            )}

            {session.error && (
              <div className="space-y-3">
                <p className="font-mono text-[10px] text-[#ff3333]">{session.error}</p>
                <button
                  onClick={connect}
                  disabled={!hasFace}
                  className={`w-full py-3 font-mono text-[10px] tracking-[0.2em] uppercase border transition-all duration-200 ${
                    hasFace
                      ? "border-border text-muted hover:border-[#333]"
                      : "border-[#333] text-[#555] cursor-not-allowed"
                  }`}
                >
                  Retry
                </button>
              </div>
            )}

            {isConnected && (
              <>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
                    Microphone
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleVoiceInput}
                      className={`w-10 h-10 flex items-center justify-center border transition-all duration-200 ${
                        !voiceInputActive
                          ? "border-[#444] text-[#666]"
                          : "border-accent text-accent shadow-[0_0_10px_rgba(0,255,136,0.15)]"
                      }`}
                    >
                      <MicIcon muted={!voiceInputActive} />
                    </button>
                    {voiceInputActive && (
                      <span className="flex items-center gap-1.5 font-mono text-[9px] text-accent tracking-[0.1em]">
                        <span className="w-1.5 h-1.5 bg-accent animate-pulse rounded-full" />
                        {voiceMode === "mirror" ? "Mirror live" : "STT active"}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
                    Volume
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">
                      <VolumeIcon />
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={session.volume}
                      onChange={(e) => session.setVolume(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-mono text-[10px] text-muted w-6 text-right">{session.volume}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <label className="block font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-3">
                    Stats
                  </label>
                  <div className="space-y-2.5 font-mono text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted tracking-[0.15em]">STATUS</span>
                      <span className="text-accent">Connected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted tracking-[0.15em]">MODE</span>
                      <span className="text-foreground">Passthrough</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted tracking-[0.15em]">VISIBILITY</span>
                      <span className={visibility === "public" ? "text-accent" : "text-foreground"}>
                        {visibility === "public" ? "Public" : "Private"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted tracking-[0.15em]">SESSION</span>
                      <span className="text-foreground">{formatTime(sessionTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted tracking-[0.15em]">LATENCY</span>
                      <span className={session.latency > 0 ? "text-foreground" : "text-[#555]"}>
                        {session.latency > 0 ? `${session.latency}ms` : "—"}
                      </span>
                    </div>
                    {session.sessionId && (
                      <div className="flex justify-between">
                        <span className="text-muted tracking-[0.15em]">ID</span>
                        <span className="text-[#666] text-[9px]">{session.sessionId.slice(0, 18)}...</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={disconnect}
                  className="w-full py-2.5 font-mono text-[10px] tracking-[0.2em] uppercase border border-[#444] text-[#777] hover:border-[#ff3333] hover:text-[#ff3333] transition-all duration-200"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 h-12 flex items-center border-t border-border shrink-0">
          <span className="font-mono text-[9px] tracking-[0.3em] text-[#555] uppercase">
            Atlas v1.0
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
