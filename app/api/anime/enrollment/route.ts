import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { creationGuard, grant } from "@/app/lib/demo-access";
import { animeEnabled, animeUpstream, ENROLLMENT_ID, FACE_TYPES } from "@/app/lib/anime-enrollment.server";

export async function POST(req: NextRequest) {
  const denied = creationGuard(req); if (denied) return denied;
  if (!animeEnabled()) return NextResponse.json({ message: "Anime demo is not enabled." }, { status: 404 });
  if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
    return NextResponse.json({ message: "Upload a PNG, JPEG or WebP portrait." }, { status: 415 });
  }
  try {
    const form = await req.formData(); const face = form.get("face");
    if (!(face instanceof Blob) || !FACE_TYPES.has(face.type) || !face.size || face.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: "Use a PNG, JPEG or WebP portrait, up to 10 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await face.arrayBuffer());
    const body = new FormData(); body.append("face", new Blob([bytes], { type: face.type }), "portrait");
    // Stable content-key: no automatic second POST after an ambiguous ACK.
    // API account ownership and enrollment cost guards remain upstream.
    const result = await animeUpstream("/v1/realtime/anime/enrollments", {
      method: "POST", headers: { "Idempotency-Key": `demo-anime-v1-${createHash("sha256").update(bytes).digest("hex")}` }, body,
    });
    const response = NextResponse.json(result.data, { status: result.status });
    if (!result.ok) return response;
    const id = result.data.enrollment_id;
    if (typeof id !== "string" || !ENROLLMENT_ID.test(id)) {
      return NextResponse.json({ message: "Atlas returned an invalid enrollment handle." }, { status: 502 });
    }
    return grant(response, "anime_enrollment", id);
  } catch {
    return NextResponse.json({ message: "Portrait preparation could not be confirmed. Do not automatically resubmit; the enrollment may already exist." }, { status: 502 });
  }
}
