# Atlas Realtime — Example App

A minimal Next.js example that demonstrates [Atlas Realtime](https://www.northmodellabs.com) avatar sessions using the [`@northmodellabs/atlas-react`](https://www.npmjs.com/package/@northmodellabs/atlas-react) SDK. Supports both **1-to-1** (private) and **public** (multi-viewer) modes.

> **New: Multi-Viewer Support** — Share your avatar session with unlimited viewers. One user drives the avatar, others watch the same stream in real time. Zero extra GPU cost. [See below →](#multi-viewer-public-mode)

**What this app does:** You bring your own LLM, TTS (e.g. ElevenLabs), and audio pipeline. Atlas provides the GPU compute and WebRTC video — you get a live avatar that lip-syncs to whatever audio you send.

## Quick Start

```bash
npx create-next-app@latest my-app --yes
cd my-app
npm install @northmodellabs/atlas-react livekit-client
```

Create `.env.local`:

```
ATLAS_API_KEY=your_atlas_api_key
ATLAS_API_URL=https://api.atlasv1.com
```

```bash
npm run dev
```

That's it. Open [http://localhost:3000](http://localhost:3000).

---

## Install

```bash
npm install @northmodellabs/atlas-react livekit-client
```

Two packages. `@northmodellabs/atlas-react` is the React hook, `livekit-client` is the WebRTC transport it uses under the hood.

## Usage

### 1. Create a session (server-side)

Your API key stays on the server. Create a Next.js API route that proxies session creation:

```typescript
// app/api/session/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();

  const res = await fetch(`${process.env.ATLAS_API_URL}/v1/realtime/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ATLAS_API_KEY}` },
    body: form,
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 2. Use the hook (client-side)

```typescript
// app/demo.tsx
"use client";

import { useAtlasSession } from "@northmodellabs/atlas-react";

export default function Demo() {
  const session = useAtlasSession({
    autoEnableMic: false,  // passthrough — we control audio
    createSession: async (face) => {
      const form = new FormData();
      form.append("face", face);
      form.append("mode", "passthrough");
      const res = await fetch("/api/session", { method: "POST", body: form });
      const data = await res.json();
      return {
        sessionId: data.session_id,
        livekitUrl: data.livekit_url,
        token: data.token,
      };
    },
    deleteSession: async (sessionId) => {
      await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
    },
  });

  return (
    <div>
      <div ref={session.videoRef} style={{ width: 512, height: 512 }} />

      <button onClick={() => session.connect(faceFile)}>
        Connect
      </button>

      <button onClick={() => session.disconnect()}>
        Disconnect
      </button>

      <p>Status: {session.status}</p>
      <p>Latency: {session.latency}ms</p>
    </div>
  );
}
```

### 3. Send audio to the avatar (passthrough mode)

In passthrough mode, you generate TTS audio yourself (ElevenLabs, OpenAI, etc.) and publish it to the avatar:

```typescript
// Generate TTS with ElevenLabs
const ttsRes = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "Hello! How are you?",
      model_id: "eleven_turbo_v2_5",
    }),
  },
);

const audioBuffer = await ttsRes.arrayBuffer();
const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

// Publish to the avatar — it will lip-sync in real time
await session.publishAudio(base64Audio);
```

---

## Hook API

```typescript
const session = useAtlasSession({
  autoEnableMic: false,
  createSession: async (face, faceUrl) => SessionInfo,
  deleteSession: async (sessionId) => void,
});
```

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `status` | `string` | `"idle"` \| `"connecting"` \| `"connected"` \| `"disconnected"` \| `"error"` |
| `error` | `string \| null` | Error message if status is `"error"` |
| `videoRef` | `RefObject<HTMLDivElement>` | Attach to a `<div>` — avatar video renders inside |
| `connect(face?, faceUrl?)` | `function` | Start a session with a face image or URL |
| `disconnect()` | `function` | End the session |
| `publishAudio(audio)` | `function` | Send TTS audio (base64, Blob, or ArrayBuffer) to the avatar for lip-sync |
| `sendChat(text)` | `function` | Send a chat message (conversation mode) |
| `setMicEnabled(enabled)` | `function` | Mute / unmute the microphone |
| `setVolume(v)` | `function` | Set playback volume (0–100) |
| `messages` | `array` | Chat message history |
| `muted` | `boolean` | Whether the mic is muted |
| `latency` | `number` | Current round-trip latency in ms |
| `volume` | `number` | Current playback volume level |
| `sessionId` | `string \| null` | Active session ID |
| `room` | `Room \| null` | Underlying LiveKit Room for advanced scenarios |

---

## Session Modes

### 1-to-1 (Private)

The default. One user creates a session, gets a token, and connects. Nobody else can see the avatar.

```
Browser  →  POST /api/session  →  Atlas creates room  →  connect with token
```

### Multi-Viewer (Public Mode)

One user creates and drives the session. Additional viewers get **view-only tokens** for the same room — they can watch but not publish audio/video.

```
Host browser    →  POST /api/session           →  full token (can publish)
Viewer browser  →  POST /api/session/:id/viewer →  view-only token (subscribe only)
```

To add viewers to an active session:

```typescript
// Server-side: get a viewer token
const res = await fetch(`${ATLAS_API_URL}/v1/realtime/session/${sessionId}/viewer`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ATLAS_API_KEY}` },
});
const { token, livekit_url, room } = await res.json();
// Give this token to the viewer client
```

```typescript
// Client-side: viewer connects with livekit-client
import { Room, RoomEvent } from "livekit-client";

const room = new Room();
await room.connect(livekit_url, token);

room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === "video") {
    const el = track.attach();
    document.getElementById("viewer-video").appendChild(el);
  }
});
```

Viewer tokens have these permissions:
| Permission | Value |
|-----------|-------|
| `can_publish` | `false` |
| `can_subscribe` | `true` |
| `can_publish_data` | `false` |

No extra GPU cost — viewers just subscribe to the existing video/audio tracks in the LiveKit room.

#### Complete viewer proxy route (server-side)

```typescript
// app/api/session/[id]/viewer/route.ts
import { NextResponse } from "next/server";

const ATLAS_API_URL = process.env.ATLAS_API_URL || "";
const ATLAS_API_KEY = process.env.ATLAS_API_KEY || "";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const res = await fetch(
    `${ATLAS_API_URL}/v1/realtime/session/${encodeURIComponent(id)}/viewer`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${ATLAS_API_KEY}` },
    },
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

#### Complete viewer page (client-side)

```typescript
// app/watch/[id]/page.tsx
"use client";

import { useEffect, useRef, useState, use } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const [status, setStatus] = useState<"loading" | "connected" | "ended" | "error">("loading");
  const videoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/session/${sessionId}/viewer`, { method: "POST" });
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();

      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          const el = track.attach();
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "contain";
          videoRef.current.innerHTML = "";
          videoRef.current.appendChild(el);
        }
        if (track.kind === Track.Kind.Audio) {
          document.body.appendChild(track.attach());
        }
      });

      room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("ended"); });

      await room.connect(data.livekit_url, data.token);
      if (!cancelled) setStatus("connected");
    })();

    return () => { cancelled = true; roomRef.current?.disconnect(); };
  }, [sessionId]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={videoRef} style={{ width: 512, height: 512, display: status === "connected" ? "block" : "none" }} />
      {status === "loading" && <p style={{ color: "#888" }}>Joining...</p>}
      {status === "ended" && <p style={{ color: "#888" }}>Session ended</p>}
      {status === "error" && <p style={{ color: "#f33" }}>Unable to join this session</p>}
    </div>
  );
}
```

### Using the UI

This example app includes a built-in visibility toggle:

1. Before connecting, switch between **Private** (1-to-1) and **Public** in the control panel
2. Connect as normal with a face image
3. In **Public** mode, a **Share** section appears with a copyable viewer link
4. Send the link to anyone — they'll land on `/watch/:sessionId` and see the avatar stream in view-only mode

| Page | Who | What they see |
|------|-----|---------------|
| `/` (main app) | Host | Full controls — face, mic, chat, swap, disconnect |
| `/watch/:id` | Viewers | Video only — "Watching" badge, "View only" indicator, no controls |

---

## Full Architecture

```
Browser  →  /api/session (Next.js)  →  /v1/realtime/session (Atlas API)
```

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | — | Main app (host view with full controls) |
| `/watch/[id]` | — | **Viewer page** (view-only, auto-connects with viewer token) |
| `/api/session` | POST | Create session (forwards face + mode to Atlas) |
| `/api/session/[id]` | GET | Check session status |
| `/api/session/[id]` | PATCH | Swap face mid-session |
| `/api/session/[id]` | DELETE | End session |
| `/api/session/[id]/viewer` | POST | Get a view-only token for multi-viewer |
| `/api/chat` | POST | Text → LLM → ElevenLabs TTS → audio response |
| `/api/config` | GET | Check which optional keys are configured |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ATLAS_API_KEY` | Yes | Your Atlas API key (`ak_...`) |
| `ATLAS_API_URL` | Yes | Atlas API base URL (`https://api.atlasv1.com`) |
| `LLM_API_KEY` | No | OpenAI / Helicone key — enables AI chat |
| `LLM_BASE_URL` | No | LLM endpoint (`https://api.openai.com/v1`) |
| `LLM_MODEL` | No | Model name (`gpt-4o-mini`) |
| `ELEVENLABS_API_KEY` | No | ElevenLabs key — enables voice responses |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice (`JBFqnCBsd6RMkjVDRZzb`) |

Without the optional keys, the app still runs — avatar connects and lip-syncs — but AI chat responses are disabled.

## Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **[@northmodellabs/atlas-react](https://www.npmjs.com/package/@northmodellabs/atlas-react)** — React hook for Atlas sessions
- **[livekit-client](https://www.npmjs.com/package/livekit-client)** — WebRTC transport

## Deploy

Deploy to Vercel (or any Node.js host). Set `ATLAS_API_KEY` and `ATLAS_API_URL` as environment variables. Optionally add the LLM and ElevenLabs keys for AI chat.

## License

MIT
