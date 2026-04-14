import { NextResponse } from "next/server";

const ATLAS_API_URL = process.env.ATLAS_API_URL || "";
const ATLAS_API_KEY = process.env.ATLAS_API_KEY || "";

const SESSION_ID_RE = /^ses_[a-f0-9]{20}$/;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ATLAS_API_KEY || !ATLAS_API_URL) {
    return NextResponse.json(
      { error: "server_error", message: "ATLAS_API_KEY or ATLAS_API_URL not configured." },
      { status: 500 },
    );
  }

  const { id } = await params;
  if (!SESSION_ID_RE.test(id)) {
    return NextResponse.json(
      { error: "invalid_session_id", message: "Session ID format is invalid." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${ATLAS_API_URL}/v1/realtime/session/${encodeURIComponent(id)}/viewer`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ATLAS_API_KEY}` },
      },
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "upstream_error", message: "Failed to reach session service." },
      { status: 502 },
    );
  }
}
