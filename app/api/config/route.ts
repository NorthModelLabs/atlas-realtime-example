import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    llm: !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL),
    tts: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  });
}
