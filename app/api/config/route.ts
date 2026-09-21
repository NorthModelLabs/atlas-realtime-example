import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    llm: !!(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY),
    tts: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  });
}
