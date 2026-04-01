import { NextRequest, NextResponse } from "next/server";

const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "";
const LLM_MODEL = process.env.LLM_MODEL || "";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "";

const SYSTEM_PROMPT =
  "You are a friendly, concise AI assistant. Keep responses short (1-3 sentences) since they will be spoken aloud via TTS.";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  if (!LLM_API_KEY || !LLM_BASE_URL || !LLM_MODEL) {
    return NextResponse.json(
      { error: "not_configured", message: "LLM_API_KEY, LLM_BASE_URL, or LLM_MODEL not set." },
      { status: 503 },
    );
  }

  let body: { text?: string; history?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected JSON with { text }." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "empty_text", message: "No text provided." },
      { status: 400 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(Array.isArray(body.history) ? body.history.slice(-20) : []),
    { role: "user", content: text },
  ];

  let llmText: string;
  try {
    const llmRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error("LLM error:", llmRes.status, err);
      return NextResponse.json(
        { error: "llm_error", message: "LLM request failed." },
        { status: 502 },
      );
    }

    const llmData = await llmRes.json();
    llmText = llmData.choices?.[0]?.message?.content?.trim() || "";
    if (!llmText) {
      return NextResponse.json(
        { error: "llm_empty", message: "LLM returned empty response." },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("LLM fetch error:", err);
    return NextResponse.json(
      { error: "llm_error", message: "Failed to reach LLM." },
      { status: 502 },
    );
  }

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    return NextResponse.json({ text: llmText, audio: null });
  }

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: llmText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!ttsRes.ok) {
      console.error("ElevenLabs error:", ttsRes.status, await ttsRes.text());
      return NextResponse.json({ text: llmText, audio: null });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");

    return NextResponse.json({ text: llmText, audio: base64 });
  } catch (err) {
    console.error("ElevenLabs fetch error:", err);
    return NextResponse.json({ text: llmText, audio: null });
  }
}
