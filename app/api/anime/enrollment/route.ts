import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { creationGuard, grant } from "@/app/lib/demo-access";
import { animeEnabled, animeUpstream, ENROLLMENT_ID, FACE_TYPES } from "@/app/lib/anime-enrollment.server";
import { portraitForm, portraitError, PortraitInputError } from "@/app/lib/demo-portrait";

export async function POST(req: NextRequest) {
  const denied = creationGuard(req); if (denied) return denied;
  if (!animeEnabled()) return NextResponse.json({ message: "Anime demo is not enabled." }, { status: 404 });
  if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
    return NextResponse.json({ message: "Upload a PNG, JPEG or WebP portrait." }, { status: 415 });
  }
  try {
    const form = await portraitForm(req); const face = form.get("face");
    if (!(face instanceof Blob) || !FACE_TYPES.has(face.type)) {
      return NextResponse.json({ message: "Upload a PNG, JPEG or WebP portrait." }, { status: 400 });
    }
    const invalid = portraitError(face);
    if (invalid) return NextResponse.json({ message: invalid }, { status: 413 });
    const bytes = Buffer.from(await face.arrayBuffer());
    const body = new FormData(); body.append("face", new Blob([bytes], { type: face.type }), "portrait");
    // Stable content-key: no automatic second POST after an ambiguous ACK.
    // The SERVER'S DEMO account pays, not an authenticated visitor account.
    // Origin is a CSRF guard, not anti-abuse authentication. Actual API-key
    // rate/pending/credit guards remain upstream; this is not a free quota.
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
  } catch (error) {
    if (error instanceof PortraitInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Portrait preparation could not be confirmed. Do not automatically resubmit; the enrollment may already exist." }, { status: 502 });
  }
}
