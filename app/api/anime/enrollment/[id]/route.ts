import { NextRequest, NextResponse } from "next/server";
import { accessGuard, grant } from "@/app/lib/demo-access";
import { animeEnabled, animeUpstream, ENROLLMENT_ID, SESSION_ID } from "@/app/lib/anime-enrollment.server";
type Context = { params: Promise<{ id: string }> };

async function owned(req: Request, context: Context) {
  const { id } = await context.params;
  if (!ENROLLMENT_ID.test(id)) return { denied: NextResponse.json({ message: "Invalid enrollment handle." }, { status: 400 }), id };
  const denied = accessGuard(req, "anime_enrollment", id);
  if (denied) return { denied, id };
  if (!animeEnabled()) return { denied: NextResponse.json({ message: "Anime demo is not enabled." }, { status: 404 }), id };
  return { denied: null, id };
}
export async function GET(req: NextRequest, context: Context) {
  const { denied, id } = await owned(req, context); if (denied) return denied;
  try {
    const result = await animeUpstream(`/v1/realtime/anime/enrollments/${encodeURIComponent(id)}`);
    return NextResponse.json(result.data, { status: result.status });
  } catch { return NextResponse.json({ message: "Enrollment status is unavailable." }, { status: 502 }); }
}
export async function POST(req: NextRequest, context: Context) {
  const { denied, id } = await owned(req, context); if (denied) return denied;
  try {
    // Recheck authenticated readiness. Preview, upload ACK and elapsed time
    // are not a ready bank. The API must also validate the exact handle.
    const ready = await animeUpstream(`/v1/realtime/anime/enrollments/${encodeURIComponent(id)}`);
    if (!ready.ok) return NextResponse.json(ready.data, { status: ready.status });
    if (ready.data.enrollment_id !== id || ready.data.realtime_ready !== true) {
      return NextResponse.json({ message: "Anime portrait is not ready to start." }, { status: 409 });
    }
    const result = await animeUpstream("/v1/realtime/session", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "passthrough", mouth_mode: "anime_realtime", anime_enrollment_id: id }),
    });
    const response = NextResponse.json(result.data, { status: result.status });
    if (!result.ok) return response;
    if (typeof result.data.session_id !== "string" || !SESSION_ID.test(result.data.session_id)) {
      return NextResponse.json({ message: "Session response could not be confirmed." }, { status: 502 });
    }
    // SAME browser-owned /api/session/id delete/voice/share lifecycle as human.
    return grant(response, "session", result.data.session_id);
  } catch {
    return NextResponse.json({ message: "Session start could not be confirmed. Do not automatically retry; Atlas may already have accepted it." }, { status: 502 });
  }
}
