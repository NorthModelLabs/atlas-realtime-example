import { accessGuard } from "@/app/lib/demo-access";
import { NextResponse } from "next/server";

export const maxDuration = 40;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = accessGuard(req, "session", id); if (denied) return denied;
  if (!/^ses_[a-f0-9]{20}$/.test(id)) return NextResponse.json({error: "Invalid session"}, {status: 400});
  if (!process.env.OPENAI_API_KEY || !process.env.ATLAS_API_KEY || !process.env.ATLAS_API_URL)
    return NextResponse.json({error: "Voice is unavailable"}, {status: 503});
  if (!req.headers.get("content-type")?.startsWith("application/sdp"))
    return NextResponse.json({error: "Expected SDP"}, {status: 415});
  const offer = await req.text();
  if (offer.length > 65536 || !offer.startsWith("v=0") || !offer.includes("m=audio"))
    return NextResponse.json({error: "Invalid SDP"}, {status: 400});
  try {
    const active = await fetch(`${process.env.ATLAS_API_URL}/v1/realtime/session/${id}`, {
      headers: {Authorization: `Bearer ${process.env.ATLAS_API_KEY}`}, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    const state = active.ok ? await active.json() : null;
    if (!state || ["ended", "failed", "error", "disconnected"].includes(state.status))
      return NextResponse.json({error: "Avatar session is not active"}, {status: 409});
    const form = new FormData();
    form.set("sdp", offer);
    form.set("session", JSON.stringify({
      type: "realtime", model: "gpt-realtime-2.1", output_modalities: ["audio"],
      instructions: "You are Atlas, a friendly voice assistant in an interactive avatar demo. Answer the user's latest request directly, maintaining the conversation's topic. Speak in English by default. Change language only when the user clearly asks you to; do not switch languages because of noise, an accent, or an ambiguous sound. Keep replies to one or two short natural sentences unless the user asks for more. If speech is unclear or incomplete, ask a brief clarification in the current language instead of guessing a request or inventing context. Do not treat background voices, noise, or your own playback as a new user request. Do not claim to see the user's screen or change the demo's settings. Follow requests to say a particular phrase exactly when appropriate.",
      max_output_tokens: 512,
      audio: {
        input: {transcription: {model: "gpt-4o-mini-transcribe", language: "en"}, turn_detection: {type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500, create_response: true, interrupt_response: true}},
        output: {voice: "coral"},
      },
    }));
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST", headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`},
      body: form, signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error("Realtime connection failed", response.status);
      return NextResponse.json({error: "Voice connection failed. Please retry."}, {status: 502});
    }
    return new Response(await response.text(), {headers: {"Content-Type": "application/sdp", "Cache-Control": "no-store"}});
  } catch {
    return NextResponse.json({error: "Voice connection timed out. Please retry."}, {status: 502});
  }
}
