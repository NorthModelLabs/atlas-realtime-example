# Atlas Realtime — Example App

A minimal Next.js example that demonstrates [Atlas Realtime](https://www.northmodellabs.com) avatar sessions in **passthrough mode** using the [`@northmodellabs/atlas-react`](https://www.npmjs.com/package/@northmodellabs/atlas-react) SDK.

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
      <video ref={session.videoRef} autoPlay playsInline />

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
      model_id: "eleven_multilingual_v2",
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
| `status` | `string` | `"idle"` \| `"connecting"` \| `"connected"` \| `"disconnecting"` \| `"disconnected"` |
| `videoRef` | `RefObject` | Attach to a `<video>` element to display the avatar |
| `connect(face?, faceUrl?)` | `function` | Start a session with a face image or URL |
| `disconnect()` | `function` | End the session |
| `publishAudio(base64)` | `function` | Send TTS audio to the avatar for lip-sync |
| `sendChat(text)` | `function` | Send a chat message (conversation mode) |
| `messages` | `array` | Chat message history |
| `latency` | `number` | Current round-trip latency in ms |
| `volume` | `number` | Current audio volume level |
| `sessionId` | `string \| null` | Active session ID |
| `room` | `Room \| null` | LiveKit room instance |

---

## Full Architecture

```
Browser  →  /api/session (Next.js)  →  /v1/realtime/session (Atlas API)
```

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/session` | POST | Create session (forwards face + mode to Atlas) |
| `/api/session/[id]` | GET | Check session status |
| `/api/session/[id]` | PATCH | Swap face mid-session |
| `/api/session/[id]` | DELETE | End session |
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
