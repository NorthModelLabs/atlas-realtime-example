import { NextResponse } from "next/server";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const DEFAULT_REALTIME_VOICE = "marin";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL;
  const voice = process.env.OPENAI_REALTIME_VOICE || DEFAULT_REALTIME_VOICE;

  const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        audio: {
          output: { voice },
        },
        instructions:
          "You are Atlas, a concise live avatar assistant. Keep replies natural and short because your audio is driving a realtime face.",
      },
    }),
  });

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "Failed to create OpenAI Realtime client secret",
        details: data,
      },
      { status: upstream.status },
    );
  }

  return NextResponse.json({
    ...data,
    model,
    voice,
  });
}
