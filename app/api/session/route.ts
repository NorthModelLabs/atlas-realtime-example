import { NextRequest, NextResponse } from "next/server";

const ATLAS_API_URL = process.env.ATLAS_API_URL || "";
const ATLAS_API_KEY = process.env.ATLAS_API_KEY || "";
const ATLAS_MODEL_VARIANT = process.env.ATLAS_MODEL_VARIANT || "";

const VALID_MODES = new Set(["conversation", "passthrough"]);
const VALID_MODEL_VARIANTS = new Set(["best", "experimental", "test", "test2", "test3", "test4", "test5"]);

function atlasHeaders(contentType?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ATLAS_API_KEY}`,
  };
  if (contentType) headers["Content-Type"] = contentType;
  if (ATLAS_MODEL_VARIANT) headers["X-Model-Variant"] = ATLAS_MODEL_VARIANT;
  return headers;
}

export async function POST(req: NextRequest) {
  try {
    if (!ATLAS_API_KEY || !ATLAS_API_URL) {
      return NextResponse.json(
        { error: "server_error", message: "ATLAS_API_KEY or ATLAS_API_URL not configured." },
        { status: 500 },
      );
    }
    if (ATLAS_MODEL_VARIANT && !VALID_MODEL_VARIANTS.has(ATLAS_MODEL_VARIANT)) {
      return NextResponse.json(
        { error: "server_error", message: "ATLAS_MODEL_VARIANT is not valid." },
        { status: 500 },
      );
    }

    const ct = req.headers.get("content-type") || "";
    let upstreamResp: Response;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const face = form.get("face");
      const mode = form.get("mode");

      if (!face || !(face instanceof Blob)) {
        return NextResponse.json(
          { error: "missing_face", message: "No face image provided." },
          { status: 400 },
        );
      }

      if (mode && !VALID_MODES.has(String(mode))) {
        return NextResponse.json(
          { error: "invalid_mode", message: "Mode must be 'conversation' or 'passthrough'." },
          { status: 400 },
        );
      }

      const upstream = new FormData();
      upstream.append("face", face);
      if (mode) upstream.append("mode", String(mode));

      try {
        upstreamResp = await fetch(`${ATLAS_API_URL}/v1/realtime/session`, {
          method: "POST",
          headers: atlasHeaders(),
          body: upstream,
        });
      } catch (fetchErr) {
        console.error("[POST /api/session] upstream fetch error (form):", fetchErr);
        return NextResponse.json(
          { error: "upstream_error", message: "Failed to reach session service." },
          { status: 502 },
        );
      }
    } else {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // empty body is fine
      }

      const faceUrl = typeof body.face_url === "string" ? body.face_url.trim() : "";
      if (faceUrl && !faceUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "invalid_face_url", message: "face_url must use HTTPS." },
          { status: 400 },
        );
      }

      const mode = typeof body.mode === "string" ? body.mode : undefined;
      if (mode && !VALID_MODES.has(mode)) {
        return NextResponse.json(
          { error: "invalid_mode", message: "Mode must be 'conversation' or 'passthrough'." },
          { status: 400 },
        );
      }

      const payload = {
        face_url: faceUrl || undefined,
        mode: mode || undefined,
      };
      try {
        upstreamResp = await fetch(`${ATLAS_API_URL}/v1/realtime/session`, {
          method: "POST",
          headers: atlasHeaders("application/json"),
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        console.error("[POST /api/session] upstream fetch error (json):", fetchErr);
        return NextResponse.json(
          { error: "upstream_error", message: "Failed to reach session service." },
          { status: 502 },
        );
      }
    }

    let data;
    try {
      data = await upstreamResp.json();
    } catch {
      return NextResponse.json(
        { error: "upstream_error", message: "Invalid response from session service." },
        { status: 502 },
      );
    }

    return NextResponse.json(data, { status: upstreamResp.status });
  } catch (err) {
    console.error("[POST /api/session] UNHANDLED:", err);
    return NextResponse.json(
      { error: "internal_error", message: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
