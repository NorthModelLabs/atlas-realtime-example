import { NextResponse } from "next/server";
export async function GET() {
  const ready = !!process.env.OPENAI_API_KEY;
  return NextResponse.json({llm: ready, tts: ready, voice: "openai-realtime"});
}
