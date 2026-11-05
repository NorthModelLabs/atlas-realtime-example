import { NextResponse } from "next/server";
import { resolveAnimeApiOrigin, animeStagingFlowEnabled } from "@/app/lib/anime-api-origin.server";
export async function GET() {
  const ready = !!process.env.OPENAI_API_KEY;
  const animeEnabled = process.env.ATLAS_ANIME_DEMO_ENABLED === "true"
    && !!process.env.ATLAS_API_KEY && !!resolveAnimeApiOrigin(process.env)
    && (process.env.ATLAS_ANIME_TARGET !== "atlas_staging" || animeStagingFlowEnabled(process.env));
  return NextResponse.json({llm: ready, tts: ready, voice: "openai-realtime", animeEnabled});
}
