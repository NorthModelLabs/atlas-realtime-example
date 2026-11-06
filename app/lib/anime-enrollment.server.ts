// Production public API only. Never reuse the owned staging/canary bridge or
// expose its tokens. Selecting an image does NOT invoke this billable route.
export const ENROLLMENT_ID = /^ae1\.[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/;
export const SESSION_ID = /^ses_[a-f0-9]{20}$/;
export const FACE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function animeEnabled() {
  return process.env.ATLAS_ANIME_DEMO_ENABLED === "true";
}
export async function animeUpstream(path: string, init: RequestInit = {}) {
  if (!animeEnabled()) throw new Error("ANIME_DEMO_DISABLED");
  const origin = process.env.ATLAS_API_URL || "";
  const key = process.env.ATLAS_API_KEY || "";
  if (!origin || !key) throw new Error("ANIME_DEMO_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}${path}`, {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` },
      signal: controller.signal, redirect: "error", cache: "no-store",
    });
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("ANIME_INVALID_RESPONSE");
    return { status: response.status, ok: response.ok, data: data as Record<string, unknown> };
  } finally { clearTimeout(timer); }
}
