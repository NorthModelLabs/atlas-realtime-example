"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect, type CSSProperties, type DragEvent, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import { useAtlasSession } from "@northmodellabs/atlas-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { useRealtimeVoice } from "@/app/lib/use-realtime-voice";

const DEFAULT_FACE_ID = "enterprise-b1450303";
const DEFAULT_FACE_URL = "/faces/enterprise-b1450303.jpg";
const FACE_PRESETS = [
  { id: "default", label: "Default", src: "/faces/default.png" },
  { id: "reel-alt", label: "Reel", src: "/faces/reel-alt.png" },
  {
    id: "enterprise-b1450303",
    label: "Enterprise",
    src: DEFAULT_FACE_URL,
  },
  { id: "jennifer", label: "Jennifer", src: "/faces/jennifer.png" },
];

type ChatMsg = {
  id: string;
  role: "user" | "atlas" | "system";
  text: string;
};

export type UiMode = "studio" | "apple" | "tiktok" | "teacher" | "meet" | "mirror";
export type VoiceMode = "ai" | "mirror";

const UI_MODES = new Set<UiMode>(["apple", "tiktok", "teacher", "meet"]);
const UI_FORMATS: { id: UiMode; label: string; urlLabel: string }[] = [
  { id: "apple", label: "Apple", urlLabel: "?ui=apple" },
  { id: "tiktok", label: "TikTok", urlLabel: "?ui=tiktok" },
  { id: "teacher", label: "Teach", urlLabel: "?ui=teacher" },
  { id: "meet", label: "Meet", urlLabel: "?ui=meet" },
];
const VOICE_MODES: { id: VoiceMode; label: string; description: string }[] = [
  { id: "ai", label: "AI voice", description: "OpenAI Realtime speaks through Atlas" },
  { id: "mirror", label: "Mirror", description: "Your microphone drives the avatar directly" },
];
const TEACHER_STEPS = [
  {
    label: "Notice the curve",
    eyebrow: "Shape",
    note: "Watch how the curve changes direction as the slope moves from positive to negative.",
  },
  {
    label: "Locate the flat point",
    eyebrow: "Turning point",
    note: "At the highlighted point the tangent is flat, so the instantaneous slope is zero.",
  },
  {
    label: "Explain the derivative",
    eyebrow: "Meaning",
    note: "The derivative describes the slope at every point: rising, flat, then falling.",
  },
];

let msgCounter = 0;

function getInitialUiMode(fallback: UiMode): UiMode {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const requestedUi = params.get("ui");
  return requestedUi && UI_MODES.has(requestedUi as UiMode) ? (requestedUi as UiMode) : fallback;
}

function getInitialVoiceMode(fallback: VoiceMode): VoiceMode {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
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

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function CaptionsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 10.25a2.5 2.5 0 1 0 0 3.5M18 10.25a2.5 2.5 0 1 0 0 3.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.25V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 4 5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
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
  initialUiMode = "apple",
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
  const { setMicEnabled } = session;

  const [sessionTime, setSessionTime] = useState(0);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState(DEFAULT_FACE_ID);
  const [faceUrl, setFaceUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [swapping, setSwapping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [faceLoading, setFaceLoading] = useState(false);

  const [configReady, setConfigReady] = useState<{ llm: boolean; tts: boolean } | null>(null);

  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [uiMode, setUiMode] = useState<UiMode>(() => getInitialUiMode(initialUiMode));
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => getInitialVoiceMode(initialVoiceMode));
  const [copied, setCopied] = useState(false);
  const [tiktokToolsOpen, setTiktokToolsOpen] = useState(false);
  const [appleSettingsOpen, setAppleSettingsOpen] = useState(false);
  const [meetLeaveArmed, setMeetLeaveArmed] = useState(false);
  const [meetPanel, setMeetPanel] = useState<"chat" | "people" | "settings" | null>(null);
  const [meetCaptions, setMeetCaptions] = useState(true);
  const [teacherStep, setTeacherStep] = useState(0);
  const [mirrorInputActive, setMirrorInputActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const swapInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const faceSelectionVersionRef = useRef(0);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfigReady(data))
      .catch(() => setConfigReady({ llm: false, tts: false }));
  }, []);

  const runModeTransition = useCallback((update: () => void) => {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (doc.startViewTransition && !reduceMotion) {
      doc.startViewTransition(() => flushSync(update));
    } else {
      update();
    }
  }, []);

  const updateFormatMode = useCallback((nextMode: UiMode) => {
    runModeTransition(() => {
      setVoiceMode("ai");
      setUiMode(nextMode);
      setTiktokToolsOpen(false);
      setAppleSettingsOpen(false);
      setMeetPanel(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("voice");
      url.searchParams.set("ui", nextMode);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    });
  }, [runModeTransition]);

  const updateVoiceMode = useCallback((nextMode: VoiceMode) => {
    setVoiceMode(nextMode);
    const url = new URL(window.location.href);
    if (nextMode === "mirror") {
      url.searchParams.set("voice", "mirror");
    } else {
      url.searchParams.delete("voice");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    setTiktokToolsOpen(false);
    setMeetLeaveArmed(false);
  }, [session.status]);

  useEffect(() => {
    setMeetLeaveArmed(false);
    setAppleSettingsOpen(false);
    setMeetPanel(null);
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

  // Format changes replace the video container while the LiveKit track stays live.
  useEffect(() => {
    const container = session.videoRef.current;
    if (!container || session.status !== "connected" || !session.room) return;
    for (const participant of session.room.remoteParticipants.values()) {
      if (participant.identity !== "avatar_worker") continue;
      for (const publication of participant.videoTrackPublications.values()) {
        const element = publication.track?.attachedElements.find(el => el.dataset.atlasLkVideo === "true");
        if (element && element.parentElement !== container) container.appendChild(element);
      }
    }
  }, [uiMode, session.status, session.room, session.videoRef]);

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
        handleFile(file, DEFAULT_FACE_ID);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const ttsTrackReadyRef = useRef<Promise<void> | null>(null);

  const stopMirrorInput = useCallback(() => {
    setMicEnabled(false);
    setMirrorInputActive(false);
  }, [setMicEnabled]);

  const startMirrorInput = useCallback(async () => {
    try {
      setMicEnabled(true);
      setMirrorInputActive(true);
    } catch (err) {
      console.warn("Failed to start mirror microphone:", err);
      addMsg("system", "Mirror microphone could not start");
    }
  }, [addMsg, setMicEnabled]);

  useEffect(() => {
    const room = session.room;
    if (session.status !== "connected" || !room) return;

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    const mediaTrack = destination.stream.getAudioTracks()[0];
    const livekitTrack = new LocalAudioTrack(mediaTrack);

    audioCtxRef.current = audioCtx;
    audioDestRef.current = destination;
    ttsTrackReadyRef.current = room.localParticipant
      .publishTrack(livekitTrack, {
        name: "tts-audio",
        source: Track.Source.Unknown,
      })
      .then(() => undefined);

    ttsTrackReadyRef.current.catch((err) => {
      console.warn("Failed to publish persistent TTS audio track:", err);
    });

    return () => {
      ttsTrackReadyRef.current = null;
      try {
        room.localParticipant.unpublishTrack(livekitTrack);
      } catch {
        /* room may already be disconnected */
      }
      livekitTrack.stop();
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      audioDestRef.current = null;
    };
  }, [session.status, session.room]);

  const voiceOutput = useCallback(async () => {
    const context = audioCtxRef.current;
    const destination = audioDestRef.current;
    const ready = ttsTrackReadyRef.current;
    if (!context || !destination || !ready) throw new Error("Avatar audio is not ready");
    await context.resume(); await ready;
    return { context, destination };
  }, []);
  const voice = useRealtimeVoice({
    sessionId: session.sessionId, output: voiceOutput,
    user: text => addMsg("user", text), assistant: text => addMsg("atlas", text),
    thinking: setAiThinking, error: text => {setVoiceError(text); if (text) addMsg("system", text);},
  });
  const stopListening = voice.stop;
  const startListening = voice.start;

  const hasFace = !!faceFile || faceUrl.trim().startsWith("https://");
  const aiEnabled = voiceMode === "ai" && configReady?.llm === true;
  const connect = async () => {
    if (!hasFace) return;
    setLocalMessages([]);
    setSessionTime(0);
    await session.connect(faceFile, faceUrl.trim() || null);
  };

  const disconnect = async () => {
    setMeetLeaveArmed(false);
    stopMirrorInput();
    stopListening();
    await session.disconnect();
    addMsg("system", "Session ended");
    setSessionTime(0);
  };

  const armMeetLeave = () => {
    setMeetLeaveArmed(true);
    window.setTimeout(() => setMeetLeaveArmed(false), 2200);
  };

  const [viewerLink, setViewerLink] = useState({ sessionId: "", path: "" });
  useEffect(() => {
    const id = session.sessionId;
    if (!id) return;
    let cancelled = false;
    fetch(`/api/session/${id}/share`).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled && typeof data.path === "string") setViewerLink({ sessionId: id, path: data.path });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [session.sessionId]);
  const viewerUrl = viewerLink.sessionId === session.sessionId && viewerLink.path
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${viewerLink.path}` : "";

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

  useEffect(() => {
    if (session.status !== "connected") {
      stopMirrorInput();
      return;
    }

    if (voiceMode === "mirror") {
      stopListening();
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
    voice.toggleMicrophone();
  }, [mirrorInputActive, startMirrorInput, stopMirrorInput, voiceMode, voice.toggleMicrophone]);

  sendChatRef.current = (text: string) => {
    if (!text.trim()) return;
    addMsg("user", text);
    if (voiceMode === "mirror") return;
    if (aiEnabled) voice.sendText(text);
    else session.sendChat(text);
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
  const tiktokOverlayMessages = voice.partialTranscript
    ? overlayMessages.filter((msg) => msg.role === "atlas").slice(-1)
    : overlayMessages;
  const showTiktokDialogue = isConnected || session.status === "connecting";
  const latestAtlasMessage = [...localMessages].reverse().find((msg) => msg.role === "atlas");
  const userCaption = voice.partialTranscript || voice.captions.user;
  const assistantCaption = voice.captions.assistant;
  const voiceInputActive = voiceMode === "mirror" ? mirrorInputActive : voice.isListening;
  const activeFormatMode: UiMode = uiMode;
  const activeFormatIndex = Math.max(0, UI_FORMATS.findIndex((format) => format.id === activeFormatMode));
  const formatPicker = (className = "") => (
    <nav
      className={`format-picker ${className}`}
      aria-label="Demo mode"
      style={{
        "--format-count": UI_FORMATS.length,
        "--format-index": activeFormatIndex,
      } as CSSProperties}
    >
      {UI_FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          onClick={() => updateFormatMode(format.id)}
          className={activeFormatMode === format.id ? "is-active" : ""}
          aria-label={`Switch to ${format.label} UI`}
          aria-current={activeFormatMode === format.id ? "page" : undefined}
        >
          {format.label}
        </button>
      ))}
    </nav>
  );
  const voiceAlert = voiceError ? <div role="alert" className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] max-w-lg rounded-xl bg-red-950 px-5 py-3 text-sm text-white">{voiceError}</div> : null;
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

  if (uiMode === "apple") {
    const appleStatus = session.status === "connecting"
      ? "Connecting"
      : isConnected
        ? voiceInputActive
          ? "Listening"
          : "Connected"
        : "Ready";
    const appleCaption = assistantCaption || (aiThinking ? "Thinking…" : voice.captions.speechActive ? "Listening…" : userCaption ? "" : isConnected ? "Say something." : "Ready when you are.");

    return (
      <div className="apple-ui h-screen w-screen overflow-hidden text-white">
        {voiceAlert}
        {hiddenFaceInputs}
        {formatPicker("global-format-picker apple-format-picker")}

        <main className="apple-shell">
          <section className="apple-stage" aria-label="Atlas avatar">
            <div className={`apple-avatar-card ${isConnected ? "is-connected" : ""}`}>
              <div
                ref={session.videoRef}
                className="apple-video"
                style={{ display: isConnected ? "flex" : "none" }}
              />
              {!isConnected && (
                <div className="apple-face-preview">
                  {facePreview ? (
                    <Image src={facePreview} alt="Selected avatar" width={640} height={640} priority unoptimized />
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload avatar">
                      <UploadIcon />
                    </button>
                  )}
                </div>
              )}
              <div className="apple-status-pill" aria-live="polite">
                <span className={voiceInputActive ? "is-live" : ""} />
                {appleStatus}
                {isConnected && <small>{formatTime(sessionTime)}</small>}
              </div>
              <div className="apple-identity-pill" aria-label={`John is ${appleStatus.toLowerCase()}`}>
                <strong>John</strong>
                <span>{appleStatus}</span>
              </div>
              {session.status === "connecting" && <div className="apple-loading-ring" aria-hidden="true" />}
            </div>

            <div className="apple-caption voice-dialogue" aria-live="polite" aria-label="Conversation captions">
              {userCaption && <p><strong>You</strong> {userCaption}{voice.partialTranscript ? "…" : ""}</p>}
              {appleCaption && <p><strong>Atlas</strong> {appleCaption}</p>}
            </div>
          </section>

          <div className="apple-controls-wrap">
            {appleSettingsOpen && (
              <aside className="apple-settings-panel" aria-label="Avatar settings">
                <header>
                  <div>
                    <strong>Settings</strong>
                    <span>{configReady?.llm && configReady?.tts ? "AI voice ready" : "Voice setup needed"}</span>
                  </div>
                  <button type="button" onClick={() => setAppleSettingsOpen(false)} aria-label="Close settings">Done</button>
                </header>

                <div className="apple-settings-section">
                  <span>Avatar</span>
                  <div className="apple-avatar-options">
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
                  </div>
                </div>

                <div className="apple-settings-list">
                  <button type="button" onClick={() => setVisibility((value) => value === "private" ? "public" : "private")}>
                    <span>{visibility === "public" ? <GlobeIcon /> : <LockIcon />} Visibility</span>
                    <strong>{visibility === "public" ? "Public" : "Private"}</strong>
                  </button>
                  <button type="button" onClick={downloadCurrentFace} disabled={!facePreview}>
                    <span><DownloadIcon /> Avatar image</span>
                    <strong>Save</strong>
                  </button>
                  {isConnected && (
                    <button type="button" className="is-danger" onClick={() => void disconnect()}>
                      <span><StopIcon /> Session</span>
                      <strong>End</strong>
                    </button>
                  )}
                </div>
              </aside>
            )}

            <nav className="apple-dock" aria-label="Avatar controls">
              <button
                type="button"
                className="apple-control apple-upload-control"
                onClick={() => (isConnected ? swapInputRef.current?.click() : fileInputRef.current?.click())}
                aria-label="Upload avatar"
                title="Upload avatar"
              >
                <span>{facePreview ? <Image src={facePreview} alt="" width={54} height={54} unoptimized /> : <UploadIcon />}</span>
                <small>Upload</small>
              </button>

              <button
                type="button"
                className={`apple-control apple-control-primary ${voiceInputActive ? "is-live" : ""}`}
                onClick={() => {
                  if (!isConnected) {
                    if (hasFace) void connect();
                    return;
                  }
                  toggleVoiceInput();
                }}
                disabled={!isConnected && !hasFace}
                aria-label={!isConnected ? "Start avatar" : voiceInputActive ? "Mute microphone" : "Start microphone"}
              >
                <span>{!isConnected ? <PlayIcon /> : <MicIcon muted={!voiceInputActive} />}</span>
                <small>{!isConnected ? "Start" : voiceInputActive ? "Mute" : "Talk"}</small>
              </button>

              <button
                type="button"
                className={`apple-control ${appleSettingsOpen ? "is-active" : ""}`}
                onClick={() => setAppleSettingsOpen((open) => !open)}
                aria-label="Open settings"
                aria-expanded={appleSettingsOpen}
              >
                <span><SettingsIcon /></span>
                <small>Settings</small>
              </button>
            </nav>
          </div>
        </main>
      </div>
    );
  }

  if (uiMode === "teacher") {
    return (
      <div className="teacher-ui min-h-screen w-screen bg-[#edf1f5] text-[#111827]">
        {voiceAlert}
        {hiddenFaceInputs}
        {voiceAlert}
      {formatPicker("global-format-picker")}
        <header className="teacher-topbar">
          <div className="teacher-heading">
            <span>Interactive lesson · Calculus</span>
            <h1>Visual calculus</h1>
            <p>See how a changing slope becomes a derivative.</p>
          </div>
          <div className="teacher-progress" aria-label={`Lesson step ${teacherStep + 1} of ${TEACHER_STEPS.length}`}>
            <div>
              {TEACHER_STEPS.map((step, index) => (
                <span key={step.label} className={index <= teacherStep ? "is-complete" : ""} />
              ))}
            </div>
            <strong>{teacherStep + 1} / {TEACHER_STEPS.length}</strong>
          </div>
        </header>

        <main className="teacher-shell">
          <section className="teacher-board">
            <div className="teacher-board-toolbar">
              <div>
                <span>Lesson 03</span>
                <strong>Understanding turning points</strong>
              </div>
              <div className="teacher-board-tools">
                <span className="teacher-board-status"><i /> Interactive board</span>
                <button
                  type="button"
                  className="teacher-board-upload"
                  onClick={() => (isConnected ? swapInputRef.current?.click() : fileInputRef.current?.click())}
                  aria-label="Upload avatar"
                  title="Upload avatar"
                >
                  <UploadIcon />
                  <span>Upload</span>
                </button>
              </div>
            </div>
            <div className={`teacher-canvas is-step-${teacherStep + 1}`}>
              <div className="teacher-axis teacher-axis-x" />
              <div className="teacher-axis teacher-axis-y" />
              <span className="teacher-axis-label teacher-axis-label-x">x</span>
              <span className="teacher-axis-label teacher-axis-label-y">y</span>
              <svg className="teacher-curve" viewBox="0 0 720 420" aria-hidden="true">
                <path d="M38 318 C160 188 226 355 338 214 C424 104 486 92 590 145 C642 170 668 202 694 238" />
                <circle className="teacher-point teacher-point-one" cx="338" cy="214" r="6" />
                <circle className="teacher-point teacher-point-two" cx="590" cy="145" r="6" />
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
              <div key={teacherStep} className="teacher-focus-card">
                <span>{TEACHER_STEPS[teacherStep].eyebrow}</span>
                <strong>{TEACHER_STEPS[teacherStep].label}</strong>
                <p>{TEACHER_STEPS[teacherStep].note}</p>
              </div>
            </div>
            <div className="teacher-problem-row" aria-label="Lesson steps">
              {TEACHER_STEPS.map((step, index) => (
                <button
                  key={step.label}
                  type="button"
                  className={teacherStep === index ? "is-active" : ""}
                  onClick={() => setTeacherStep(index)}
                  aria-pressed={teacherStep === index}
                >
                  <span>0{index + 1}</span>
                  <strong>{step.label}</strong>
                  <i aria-hidden="true">→</i>
                </button>
              ))}
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
              <span>{isConnected ? "Live tutor" : "Tutor preview"}</span>
              <h2>Ask Atlas</h2>
              <p>
                {isConnected
                  ? assistantCaption || latestAtlasMessage?.text || `Let’s work through step ${teacherStep + 1}: ${TEACHER_STEPS[teacherStep].label.toLowerCase()}.`
                  : "Start a short guided explanation, or ask a question about the graph."}
              </p>
            </div>
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
              <button
                type="button"
                className="teacher-upload-control"
                onClick={() => (isConnected ? swapInputRef.current?.click() : fileInputRef.current?.click())}
                aria-label="Upload avatar"
                title="Upload avatar"
              >
                <UploadIcon />
                <span>Upload</span>
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
            <form
              className="teacher-prompt"
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim() && isConnected && !aiThinking) {
                  sendChat(chatInput.trim());
                  setChatInput("");
                }
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isConnected ? "Ask about the board..." : "Call Atlas to ask a question"}
                disabled={!isConnected || aiThinking}
              />
              <button type="submit" disabled={!isConnected || !chatInput.trim() || aiThinking}>
                Send
              </button>
            </form>
          </aside>
        </main>
      </div>
    );
  }

  if (uiMode === "meet") {
    const meetMessages = localMessages.filter((message) => message.role !== "system");
    const meetPanelTitle = meetPanel === "chat" ? "In-call messages" : meetPanel === "people" ? "People" : "Call settings";
    return (
      <div className="meet-ui mode-shell h-screen w-screen overflow-hidden bg-[#202124] text-white">
        {voiceAlert}
        {hiddenFaceInputs}
        {formatPicker("global-format-picker meet-global-format-picker")}
        <header className="meet-topbar">
          <div className="meet-brand">
            <span className="meet-brand-mark" aria-hidden="true"><CameraIcon /></span>
            <div>
              <strong>Atlas conversation</strong>
              <span>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · atlas-demo</span>
            </div>
          </div>
          <div className="meet-header-actions">
            <button
              type="button"
              className={meetPanel === "chat" ? "meet-header-icon is-active" : "meet-header-icon"}
              onClick={() => setMeetPanel((panel) => panel === "chat" ? null : "chat")}
              aria-label="Open chat"
              aria-expanded={meetPanel === "chat"}
            >
              <ChatIcon />
            </button>
            <button
              type="button"
              className={meetPanel === "people" ? "meet-room-pill is-active" : "meet-room-pill"}
              onClick={() => setMeetPanel((panel) => panel === "people" ? null : "people")}
              aria-label="Show people"
              aria-expanded={meetPanel === "people"}
            >
              <PeopleIcon />
              <strong>{isConnected ? 2 : 1}</strong>
            </button>
          </div>
        </header>

        <main className={`meet-stage ${meetPanel ? "has-panel" : ""}`}>
          <section className="meet-participant-grid" aria-label="Call participants">
          <article className="meet-main-tile" aria-label="Atlas video tile">
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
            <button
              type="button"
              className="meet-avatar-upload"
              onClick={() => (isConnected ? swapInputRef.current?.click() : fileInputRef.current?.click())}
              aria-label="Upload avatar"
              title="Upload avatar"
            >
              <UploadIcon />
              <span>Upload</span>
            </button>
            <div className="meet-call-state" aria-live="polite">
              <span className={voiceInputActive ? "is-live" : ""} />
              {session.status === "connecting" ? "Joining…" : isConnected ? "Connected" : "Preview"}
            </div>
            <div className="meet-avatar-status">
              <strong>Atlas</strong>
              <span>{isConnected ? `${formatTime(sessionTime)} · AI assistant` : "Ready to join"}</span>
            </div>
            {meetCaptions && (
              <div className="meet-floating-caption" aria-live="polite">
                <strong>{voice.partialTranscript || (userCaption && !assistantCaption) ? "You" : "Atlas"}</strong>
                <span>
                  {voice.partialTranscript
                    ? `${voice.partialTranscript}…`
                    : aiThinking
                      ? "Thinking…"
                      : assistantCaption || userCaption || (isConnected ? "Listening — say something." : "Join when you’re ready.")}
                </span>
              </div>
            )}
          </article>

          <article className="meet-user-tile" aria-label="Your camera tile">
            <div className="meet-user-avatar" aria-hidden="true">
              <PeopleIcon />
            </div>
            <div className="meet-user-camera-state">
              <CameraIcon />
              <span>Camera off</span>
            </div>
            <strong>You</strong>
            <span className="meet-user-host">Host</span>
          </article>
          </section>

          {meetPanel && (
            <aside className="meet-side-panel" aria-label={meetPanelTitle}>
              <header>
                <div>
                  <strong>{meetPanelTitle}</strong>
                  <span>{meetPanel === "chat" ? "Messages are visible during this call" : meetPanel === "people" ? `${isConnected ? 2 : 1} in this call` : "Personalize your meeting"}</span>
                </div>
                <button type="button" onClick={() => setMeetPanel(null)} aria-label="Close panel"><CloseIcon /></button>
              </header>

              {meetPanel === "chat" && (
                <div className="meet-chat-panel">
                  <div className="meet-chat-messages">
                    {meetMessages.length === 0 && (
                      <div className="meet-panel-empty">
                        <ChatIcon />
                        <strong>No messages yet</strong>
                        <span>Your conversation with Atlas appears here.</span>
                      </div>
                    )}
                    {meetMessages.map((message) => (
                      <div key={message.id} className={`meet-chat-message is-${message.role}`}>
                        <strong>{message.role === "atlas" ? "Atlas" : "You"}</strong>
                        <p>{message.text}</p>
                      </div>
                    ))}
                    {aiThinking && <div className="meet-chat-thinking">Atlas is thinking…</div>}
                  </div>
                  <form
                    className="meet-chat-compose"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (chatInput.trim() && isConnected && !aiThinking) {
                        sendChat(chatInput.trim());
                        setChatInput("");
                      }
                    }}
                  >
                    <input
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder={isConnected ? "Message Atlas" : "Join to send a message"}
                      disabled={!isConnected || aiThinking}
                      aria-label="Message Atlas"
                    />
                    <button type="submit" disabled={!isConnected || !chatInput.trim() || aiThinking} aria-label="Send message">
                      <span>↑</span>
                    </button>
                  </form>
                </div>
              )}

              {meetPanel === "people" && (
                <div className="meet-people-panel">
                  <span className="meet-panel-label">In this call</span>
                  {isConnected && (
                    <div className="meet-person-row">
                      <span className="meet-person-avatar">
                        {facePreview ? <Image src={facePreview} alt="" width={44} height={44} unoptimized /> : "A"}
                      </span>
                      <span><strong>Atlas</strong><small>AI assistant</small></span>
                      <span className="meet-person-live">Live</span>
                    </div>
                  )}
                  <div className="meet-person-row">
                    <span className="meet-person-avatar is-you">Y</span>
                    <span><strong>You</strong><small>Meeting host</small></span>
                    <MicIcon muted={!voiceInputActive} />
                  </div>
                </div>
              )}

              {meetPanel === "settings" && (
                <div className="meet-settings-panel">
                  <div className="meet-settings-group">
                    <span className="meet-panel-label">Avatar</span>
                    <div className="meet-avatar-options">
                      {FACE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => void selectPresetFace(preset)}
                          className={selectedFaceId === preset.id ? "is-selected" : ""}
                          aria-label={`Use ${preset.label} avatar`}
                          title={preset.label}
                        >
                          <Image src={preset.src} alt="" width={64} height={64} unoptimized />
                        </button>
                      ))}
                      <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload avatar"><UploadIcon /></button>
                    </div>
                  </div>
                  <button type="button" className="meet-settings-row" onClick={() => setVisibility((value) => value === "private" ? "public" : "private")}>
                    <span>{visibility === "public" ? <GlobeIcon /> : <LockIcon />} Meeting visibility</span>
                    <strong>{visibility === "public" ? "Public" : "Private"}</strong>
                  </button>
                  <button type="button" className="meet-settings-row" onClick={downloadCurrentFace} disabled={!facePreview}>
                    <span><DownloadIcon /> Avatar image</span>
                    <strong>Save</strong>
                  </button>
                  <div className="meet-ai-ready">
                    <span className={configReady?.llm && configReady?.tts ? "is-ready" : ""} />
                    {configReady?.llm && configReady?.tts ? "AI voice is ready" : "AI voice needs setup"}
                  </div>
                </div>
              )}
            </aside>
          )}
        </main>

        <footer className="meet-footer">
          <div className="meet-footer-meta">
            <strong>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
            <span>atlas-demo</span>
          </div>

          <nav className="meet-bottom-bar" aria-label="Call controls">
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!isConnected}
              className={voiceInputActive ? "is-live" : ""}
              aria-label={voiceInputActive ? "Mute microphone" : "Start microphone"}
            >
              <MicIcon muted={!voiceInputActive} /><span className="meet-tooltip">{voiceInputActive ? "Mute" : "Unmute"}</span>
            </button>
            <button
              type="button"
              onClick={() => (isConnected ? swapInputRef.current?.click() : fileInputRef.current?.click())}
              aria-label="Upload avatar"
            >
              <UploadIcon /><span className="meet-tooltip">Upload avatar</span>
            </button>
            <button
              type="button"
              onClick={() => setMeetCaptions((visible) => !visible)}
              className={meetCaptions ? "is-active" : ""}
              aria-label={meetCaptions ? "Turn off captions" : "Turn on captions"}
              aria-pressed={meetCaptions}
            >
              <CaptionsIcon /><span className="meet-tooltip">Captions</span>
            </button>
            <button
              type="button"
              onClick={() => setMeetPanel((panel) => panel === "settings" ? null : "settings")}
              className={meetPanel === "settings" ? "is-active" : ""}
              aria-label="More call actions"
              aria-expanded={meetPanel === "settings"}
            >
              <MoreIcon /><span className="meet-tooltip">More options</span>
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
              aria-label={isConnected ? (meetLeaveArmed ? "Confirm leave call" : "Leave call") : "Join call"}
            >
              {isConnected ? <StopIcon /> : <PlayIcon />}
              <span className="meet-tooltip">{isConnected ? (meetLeaveArmed ? "Click again to leave" : "Leave call") : "Join call"}</span>
            </button>
          </nav>

          <div className="meet-corner-controls">
            <button
              type="button"
              onClick={() => setMeetPanel((panel) => panel === "people" ? null : "people")}
              className={meetPanel === "people" ? "is-active" : ""}
              aria-label="Show people"
              aria-expanded={meetPanel === "people"}
            ><PeopleIcon /></button>
            <button
              type="button"
              onClick={() => setMeetPanel((panel) => panel === "chat" ? null : "chat")}
              className={meetPanel === "chat" ? "is-active" : ""}
              aria-label="Open chat"
              aria-expanded={meetPanel === "chat"}
            ><ChatIcon /></button>
            <button
              type="button"
              onClick={() => setVisibility((value) => value === "private" ? "public" : "private")}
              className={visibility === "public" ? "is-active" : ""}
              aria-label="Toggle meeting visibility"
              title={visibility === "public" ? "Public meeting" : "Private meeting"}
            >{visibility === "public" ? <GlobeIcon /> : <LockIcon />}</button>
          </div>
        </footer>

      </div>
    );
  }

  if (uiMode === "mirror") {
    return (
      <div className="mirror-ui min-h-screen w-screen overflow-hidden bg-[#f7f7f4] text-[#111111]">
        {voiceAlert}
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
      {voiceAlert}
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

            {showTiktokDialogue && (
            <div className="tiktok-dialogue pointer-events-none absolute inset-x-5 z-20 flex flex-col items-start gap-2">
              {tiktokOverlayMessages.length === 0 && !voice.partialTranscript && !aiThinking && (
                <div className="tiktok-caption tiktok-status-caption">
                  {voiceMode === "mirror"
                    ? mirrorInputActive
                      ? "Mirror live"
                      : "Tap mic to mirror"
                    : aiEnabled && voice.isListening
                      ? "Listening..."
                      : "Type or speak to start"}
                </div>
              )}
              {tiktokOverlayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`tiktok-caption tiktok-message ${
                    msg.role === "atlas"
                      ? "tiktok-message-atlas"
                      : "tiktok-message-user"
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
              {voice.partialTranscript && (
                <div className="tiktok-caption tiktok-message tiktok-message-partial">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                    You
                  </span>
                  {voice.partialTranscript}...
                </div>
              )}
              {aiThinking && (
                <div className="tiktok-caption tiktok-status-caption">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              )}
            </div>
            )}

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
                aria-label="Upload avatar"
                title="Upload avatar"
              >
                {facePreview ? (
                  <Image src={facePreview} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <UploadIcon />
                )}
              </button>
              <span className="tiktok-action-label tiktok-upload-label">
                {swapping ? "Upload…" : "Upload"}
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
                  ? voice.isListening
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
            {voice.partialTranscript && (
              <div className="flex flex-col items-end">
                <span className="font-mono text-[9px] tracking-[0.15em] text-[#888] uppercase mb-1">
                  You
                </span>
                <div className="px-3 py-2 bg-[#151515] border border-[#333] text-[#666] text-[12px] italic">
                  {voice.partialTranscript}...
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
                        ? "Voice is unavailable"
                        : !configReady.llm
                          ? "Voice is unavailable"
                          : "Voice is unavailable"}
                    </p>
                    <p className="font-mono text-[9px] text-[#886600] mt-1 leading-relaxed">
                      Voice is temporarily unavailable. Please try again later.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent" />
                  <p className="font-mono text-[10px] text-accent tracking-[0.1em]">
                    OpenAI Realtime voice enabled
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
