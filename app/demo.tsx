"use client";

import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from "react";
import { useAtlasSession } from "@northmodellabs/atlas-react";

const SHOWCASE_FACES = Array.from({ length: 74 }, (_, i) => ({
  id: i + 1,
  src: `/faces/${i + 1}.jpg`,
}));

type ChatMsg = {
  id: string;
  role: "user" | "atlas" | "system";
  text: string;
};

interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

let msgCounter = 0;

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

function createSpeechRecognition() {
  const SpeechRecognition =
    (globalThis as unknown as Record<string, unknown>).SpeechRecognition ||
    (globalThis as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const rec = new (SpeechRecognition as new () => SpeechRecognitionLike)();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";
  return rec;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
}

export default function DemoPage() {
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
      await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
    },
  });

  const [sessionTime, setSessionTime] = useState(0);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [swapping, setSwapping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  const [configReady, setConfigReady] = useState<{ llm: boolean; tts: boolean } | null>(null);

  const [listening, setListening] = useState(false);
  const [loadingFaceId, setLoadingFaceId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [copied, setCopied] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const swapInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<ChatHistory[]>([]);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const sttBufferRef = useRef("");
  const respondingRef = useRef(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfigReady(data))
      .catch(() => setConfigReady({ llm: false, tts: false }));
  }, []);

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

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFaceFile(file);
    setFaceUrl("");
    const reader = new FileReader();
    reader.onload = (e) => setFacePreview(e.target?.result as string);
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
    async (file: File) => {
      if (!session.sessionId || !file.type.startsWith("image/")) return;
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
        } else {
          addMsg("system", "Face swapped");
          const reader = new FileReader();
          reader.onload = (e) => setFacePreview(e.target?.result as string);
          reader.readAsDataURL(file);
        }
      } catch {
        addMsg("system", "Face swap failed");
      } finally {
        setSwapping(false);
        if (swapInputRef.current) swapInputRef.current.value = "";
      }
    },
    [session.sessionId, addMsg],
  );

  const handleSelectShowcaseFace = useCallback(async (face: typeof SHOWCASE_FACES[number]) => {
    setLoadingFaceId(face.id);
    try {
      const resp = await fetch(face.src);
      const blob = await resp.blob();
      const file = new File([blob], `face-${face.id}.jpg`, { type: "image/jpeg" });
      if (session.status === "connected") {
        await handleSwapFace(file);
      } else {
        handleFile(file);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingFaceId(null);
    }
  }, [session.status, handleSwapFace, handleFile]);

  const playTtsResponse = useCallback(async (base64Audio: string): Promise<number> => {
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const durationMs = buf.duration * 1000;
      ctx.close();

      await session.publishAudio(base64Audio);
      return durationMs;
    } catch (err) {
      console.error("Failed to publish TTS audio:", err);
      return 0;
    }
  }, [session]);

  const hasFace = !!faceFile || faceUrl.trim().startsWith("https://");
  const aiEnabled = configReady?.llm === true;

  const connect = async () => {
    if (!hasFace) return;
    setLocalMessages([]);
    setSessionTime(0);
    chatHistoryRef.current = [];
    await session.connect(faceFile, faceUrl.trim() || null);
  };

  const disconnect = async () => {
    stopListening();
    await session.disconnect();
    addMsg("system", "Session ended");
    setSessionTime(0);
    chatHistoryRef.current = [];
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

  // --- Web Speech API for hands-free voice conversation ---
  const startListening = useCallback(() => {
    if (recognitionRef.current || !aiEnabled) return;
    const rec = createSpeechRecognition();
    if (!rec) return;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (respondingRef.current) return;
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          transcript += result[0].transcript;
        }
      }
      if (transcript.trim()) {
        sttBufferRef.current = "";
        sendChat(transcript.trim());
      }
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        try { rec.start(); } catch { /* already started */ }
      }
    };

    rec.onerror = (e: Event & { error?: string }) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      if (e.error === "not-allowed") {
        recognitionRef.current = null;
        setListening(false);
        return;
      }
      console.error("Speech recognition error:", e.error);
    };

    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, [aiEnabled, sendChat]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onend = null;
      rec.stop();
    }
    setListening(false);
    sttBufferRef.current = "";
  }, []);

  sendChatRef.current = async (text: string) => {
    if (!text.trim() || respondingRef.current) return;
    addMsg("user", text);

    if (aiEnabled) {
      respondingRef.current = true;
      stopListening();
      setAiThinking(true);
      chatHistoryRef.current.push({ role: "user", content: text });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, history: chatHistoryRef.current.slice(0, -1) }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "AI request failed" }));
          addMsg("system", err.message || "AI request failed");
          setAiThinking(false);
          return;
        }

        const data = await res.json();
        setAiThinking(false);

        if (data.audio) {
          const durationMs = await playTtsResponse(data.audio);

          if (data.text) {
            addMsg("atlas", data.text);
            chatHistoryRef.current.push({ role: "assistant", content: data.text });
          }

          setAvatarSpeaking(true);
          await new Promise((r) => setTimeout(r, durationMs + 500));
          setAvatarSpeaking(false);
        } else if (data.text) {
          addMsg("atlas", data.text);
          chatHistoryRef.current.push({ role: "assistant", content: data.text });
        }
      } catch {
        addMsg("system", "Failed to reach AI");
        setAiThinking(false);
      } finally {
        setAvatarSpeaking(false);
        respondingRef.current = false;
        startListening();
      }
    } else {
      session.sendChat(text);
    }
  };

  // Auto-start listening when connected + AI enabled
  useEffect(() => {
    if (session.status === "connected" && aiEnabled) {
      startListening();
    }
    return () => { stopListening(); };
  }, [session.status, aiEnabled, startListening, stopListening]);

  const isConnected = session.status === "connected";
  const isDisconnected = session.status === "idle" || session.status === "disconnected";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] font-sans">
      {/* Video Panel */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        <div
          ref={session.videoRef}
          className="w-full h-full max-w-[512px] max-h-[512px] mx-auto flex items-center justify-center"
          style={{ display: isConnected ? "flex" : "none" }}
        />

        {!isConnected && (
          <div className="animate-breathe">
            <svg width="180" height="220" viewBox="0 0 180 220" fill="none" className="text-[#e0e0e0]">
              <circle cx="90" cy="72" r="36" stroke="currentColor" strokeWidth="1" />
              <path d="M30 200c0-33.137 26.863-60 60-60s60 26.863 60 60" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}

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
      </div>

      {/* Transcript Panel */}
      {isConnected && (
        <div className="w-[300px] border-l border-border bg-panel flex flex-col">
          <div className="px-4 h-14 flex items-center border-b border-border shrink-0">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
              Transcript
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll px-4 py-3 space-y-3">
            {localMessages.length === 0 && (
              <p className="font-mono text-[10px] text-[#666] text-center mt-8">
                {aiEnabled
                  ? listening
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
            {(aiThinking || avatarSpeaking) && (
              <div className="flex flex-col items-start">
                <span className="font-mono text-[9px] tracking-[0.15em] text-[#888] uppercase mb-1">
                  Atlas
                </span>
                <div className="px-3 py-2 bg-[#0a1a0f] border border-[#1a3a20] text-accent text-[12px]">
                  <span className="animate-pulse">{aiThinking ? "Thinking..." : "Speaking..."}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-3 border-t border-border shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim() && !aiThinking && !avatarSpeaking) {
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
                disabled={aiThinking || avatarSpeaking}
                className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-[12px] text-foreground placeholder-[#555] font-sans focus:outline-none focus:border-accent transition-all duration-200 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || aiThinking || avatarSpeaking}
                className="px-3 py-2 border border-accent text-accent font-mono text-[10px] tracking-[0.1em] uppercase hover:bg-accent hover:text-[#050505] transition-all duration-200 disabled:border-[#333] disabled:text-[#555] disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="w-[320px] border-l border-border bg-panel flex flex-col panel-glow-border">
        <div className="px-6 h-14 flex items-center border-b border-border shrink-0">
          <span className="font-mono text-[11px] tracking-[0.3em] text-foreground uppercase font-semibold">
            ✦
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll">
          {/* AI Status Banner */}
          {configReady && (
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
                  <img src={facePreview} alt="Face preview" className="w-16 h-16 object-cover border border-accent" />
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

            {/* Showcase face grid */}
            <div className="mt-3">
              <span className="block font-mono text-[9px] tracking-[0.15em] text-[#555] uppercase mb-2">
                Or choose a reference
              </span>
              <div className="grid grid-cols-10 gap-1">
                {SHOWCASE_FACES.map((face) => (
                  <button
                    key={face.id}
                    onClick={() => handleSelectShowcaseFace(face)}
                    disabled={loadingFaceId !== null || swapping}
                    className={`relative aspect-square overflow-hidden border transition-all duration-150 ${
                      loadingFaceId === face.id
                        ? "border-accent opacity-60"
                        : "border-[#222] hover:border-accent hover:shadow-[0_0_8px_rgba(0,255,136,0.12)]"
                    }`}
                  >
                    <img src={face.src} alt={`Face ${face.id}`} className="w-full h-full object-cover" loading="lazy" />
                    {loadingFaceId === face.id && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-2 h-2 bg-accent animate-pulse" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

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
              Mode
            </label>
            <div className="flex border border-border">
              <div className="flex-1 py-2.5 font-mono text-[10px] tracking-[0.2em] uppercase text-center bg-[#050505] text-accent shadow-[inset_0_0_20px_rgba(0,255,136,0.06),0_0_12px_rgba(0,255,136,0.1)]">
                Passthrough
              </div>
            </div>
            <p className="font-mono text-[9px] text-[#555] mt-2">
              You bring LLM, TTS, and audio — we provide the GPU compute and WebRTC video
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
                      onClick={() => listening ? stopListening() : startListening()}
                      className={`w-10 h-10 flex items-center justify-center border transition-all duration-200 ${
                        !listening
                          ? "border-[#444] text-[#666]"
                          : "border-accent text-accent shadow-[0_0_10px_rgba(0,255,136,0.15)]"
                      }`}
                    >
                      <MicIcon muted={!listening} />
                    </button>
                    {listening && aiEnabled && (
                      <span className="flex items-center gap-1.5 font-mono text-[9px] text-accent tracking-[0.1em]">
                        <span className="w-1.5 h-1.5 bg-accent animate-pulse rounded-full" />
                        STT active
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
    </div>
  );
}
