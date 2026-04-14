"use client";

import { useEffect, useRef, useState, use } from "react";
import { Room, RoomEvent, Track, type RemoteTrackPublication } from "livekit-client";

type ViewerState = "loading" | "connecting" | "connected" | "ended" | "error";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [state, setState] = useState<ViewerState>("loading");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!/^ses_[a-f0-9]{20}$/.test(sessionId)) {
      setError("Invalid session link.");
      setState("error");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}/viewer`, { method: "POST" });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setError(data.message || data.error || "Unable to join this session.");
          setState("error");
          return;
        }

        setState("connecting");

        const room = new Room({
          adaptiveStream: true,
          dynacast: false,
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, publication) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            const el = track.attach();
            el.style.width = "100%";
            el.style.height = "100%";
            el.style.objectFit = "contain";
            videoRef.current.innerHTML = "";
            videoRef.current.appendChild(el);
          }
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setState("ended");
        });

        await room.connect(data.livekit_url, data.token);
        if (!cancelled) setState("connected");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection failed.");
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
    };
  }, [sessionId]);

  useEffect(() => {
    if (state !== "connected") return;
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex h-screen w-screen bg-[#050505] items-center justify-center font-sans">
      <div className="relative w-full h-full max-w-[720px] max-h-[720px] flex items-center justify-center">
        {/* Video container */}
        <div
          ref={videoRef}
          className="w-full h-full flex items-center justify-center"
          style={{ display: state === "connected" ? "flex" : "none" }}
        />

        {/* Loading state */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border border-[#555] border-t-accent animate-spin" />
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#888] uppercase">
              Joining session...
            </p>
          </div>
        )}

        {/* Connecting state */}
        {state === "connecting" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-6 h-6 border border-[#555] border-t-accent animate-spin" />
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#888] uppercase">
              Connecting to stream...
            </p>
          </div>
        )}

        {/* Ended state */}
        {state === "ended" && (
          <div className="flex flex-col items-center gap-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="font-mono text-[11px] tracking-[0.15em] text-[#888] uppercase">
              Session ended
            </p>
            <p className="font-mono text-[9px] text-[#555]">
              The host has disconnected.
            </p>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4 max-w-[300px] text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff3333" strokeWidth="1">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="font-mono text-[11px] tracking-[0.15em] text-[#ff3333] uppercase">
              Unable to join
            </p>
            <p className="font-mono text-[9px] text-[#888]">
              {error}
            </p>
          </div>
        )}

        {/* Status bar */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.25em] uppercase select-none">
          {state === "connected" && (
            <>
              <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
              <span className="text-accent">Watching</span>
              <span className="text-[#555] ml-2">{formatTime(elapsed)}</span>
            </>
          )}
        </div>

        {/* View-only badge */}
        {state === "connected" && (
          <div className="absolute top-6 right-6 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-[#666] uppercase bg-[#111] border border-[#333] px-2.5 py-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View only
          </div>
        )}
      </div>
    </div>
  );
}
