import { createHash } from "node:crypto";
import { creationGuard, grant } from "@/app/lib/demo-access";
import { animeStagingFlowEnabled, resolveAnimeApiOrigin } from "@/app/lib/anime-api-origin.server";
import { originalRasterEnvelope } from "@/app/lib/anime-raster-transport.server";
import { NextRequest, NextResponse } from "next/server";

const ATLAS_ANIME_API_URL = resolveAnimeApiOrigin(process.env);
const ATLAS_API_KEY = process.env.ATLAS_API_KEY || "";
const MAX_FACE_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const READY_ENROLLMENT_TTL_MS = 6 * 60 * 60 * 1000;
const READY_ENROLLMENT_CACHE_MAX = 128;
const ENROLLMENT_POLL_TRANSIENT_RETRIES = 3;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const maxDuration = 1800;

type JsonObject = Record<string, unknown>;
type ReadyEnrollment = { enrollmentId: string; expiresAt: number };

const globalForAnimeEnrollment = globalThis as typeof globalThis & {
  __atlasReadyAnimeEnrollments?: Map<string, ReadyEnrollment>;
};
const readyAnimeEnrollments = globalForAnimeEnrollment.__atlasReadyAnimeEnrollments
  ?? new Map<string, ReadyEnrollment>();
globalForAnimeEnrollment.__atlasReadyAnimeEnrollments = readyAnimeEnrollments;

function cachedEnrollment(cacheKey: string) {
  const cached = readyAnimeEnrollments.get(cacheKey);
  if (!cached) return "";
  if (cached.expiresAt <= Date.now()) {
    readyAnimeEnrollments.delete(cacheKey);
    return "";
  }
  // Refresh recency for the bounded insertion-order map.
  readyAnimeEnrollments.delete(cacheKey);
  readyAnimeEnrollments.set(cacheKey, cached);
  return cached.enrollmentId;
}

function rememberEnrollment(cacheKey: string, enrollmentId: string) {
  readyAnimeEnrollments.delete(cacheKey);
  readyAnimeEnrollments.set(cacheKey, {
    enrollmentId,
    expiresAt: Date.now() + READY_ENROLLMENT_TTL_MS,
  });
  while (readyAnimeEnrollments.size > READY_ENROLLMENT_CACHE_MAX) {
    const oldest = readyAnimeEnrollments.keys().next().value;
    if (typeof oldest !== "string") break;
    readyAnimeEnrollments.delete(oldest);
  }
}

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

async function readJson(response: Response): Promise<JsonObject | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? value as JsonObject : null;
  } catch {
    return null;
  }
}

function upstreamResult(response: Response, data: JsonObject | null) {
  if (!data) {
    // Preserve an upstream rejection (notably an edge/WAF 403) when its body
    // is not JSON. Do not expose that body or retry a paid enrollment here.
    const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
    return fail(status, status === 403 ? "upstream_forbidden" : "upstream_error",
      status === 403
        ? "Atlas rejected the anime portrait request."
        : "Atlas returned an invalid response.");
  }
  return NextResponse.json(data, { status: response.status });
}

function timeoutMs() {
  const configured = Number(process.env.ATLAS_ANIME_ENROLLMENT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.max(30_000, Math.min(configured, 30 * 60 * 1000));
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryableEnrollmentPollStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

// Status reads are idempotent; retry only transient failures against the same
// durable enrollment handle. Never replay the paid enrollment POST here.
async function fetchEnrollmentStatus(url: string, deadline: number): Promise<Response | null> {
  let retries = 0;
  while (Date.now() < deadline) {
    let response: Response | null = null;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${ATLAS_API_KEY}` }, cache: "no-store" });
    } catch {
      if (retries >= ENROLLMENT_POLL_TRANSIENT_RETRIES) return null;
    }
    if (response && (!retryableEnrollmentPollStatus(response.status) || retries >= ENROLLMENT_POLL_TRANSIENT_RETRIES)) {
      return response;
    }
    const delay = Math.min(250 * 2 ** retries, 1_000, deadline - Date.now());
    if (delay <= 0) return null;
    retries += 1;
    await sleep(delay);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = creationGuard(req); if (denied) return denied;
  if (process.env.ATLAS_ANIME_TARGET === "atlas_staging" && !animeStagingFlowEnabled(process.env)) {
    return fail(404, "not_enabled", "Anime staging enrollment and sessions are disabled or not pinned to atlas_staging.");
  }
  if (process.env.ATLAS_ANIME_DEMO_ENABLED !== "true") {
    return fail(404, "not_enabled", "The isolated anime demo is not enabled on this server.");
  }
  if (!ATLAS_ANIME_API_URL || !ATLAS_API_KEY) {
    return fail(500, "server_error", "Anime API URL or Atlas API key is not configured.");
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return fail(415, "unsupported_media_type", "Upload an anime portrait as multipart form data.");
  }

  const form = await req.formData();
  const face = form.get("face");
  if (!(face instanceof Blob)) {
    return fail(400, "missing_face", "Select an anime portrait before connecting.");
  }
  if (face.size > MAX_FACE_BYTES) {
    return fail(413, "face_too_large", "Face image must be 10 MB or smaller.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(face.type)) {
    return fail(415, "unsupported_face", "Use a PNG, JPEG, or WebP portrait.");
  }

  const bytes = Buffer.from(await face.arrayBuffer());
  // Keep legacy multipart as the default. The alternate wire format is only
  // safe when the paired API's same-byte raster validator is enabled.
  const encodedRaster = process.env.ATLAS_ANIME_RASTER_JSON_UPLOAD_ENABLED === "true";
  if (encodedRaster && !["image/png", "image/webp"].includes(face.type)) {
    return fail(415, "strict_raster_format", "The verified upload transport currently supports PNG and WebP only.");
  }
  if (encodedRaster && (face.size < 12 || face.size > 4_000_000)) {
    return fail(413, "strict_raster_size", "The verified portrait transport is limited to 4 MB.");
  }
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const revision = (process.env.ATLAS_ANIME_ENROLLMENT_REVISION || "v1")
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 24);
  const cacheKey = `${revision}:${sourceHash}`;
  let enrollmentId = cachedEnrollment(cacheKey);
  const enrollmentCacheHit = Boolean(enrollmentId);

  let response: Response;
  if (!enrollmentId) {
    const enrollment = new FormData();
    enrollment.append(
      "face",
      new Blob([bytes], { type: face.type }),
      face instanceof File && face.name ? face.name : "anime-portrait.png",
    );
    const transport = encodedRaster
      ? originalRasterEnvelope(bytes, face.type)
      : { headers: {}, body: enrollment as BodyInit };
    try {
      response = await fetch(`${ATLAS_ANIME_API_URL}/v1/realtime/anime/enrollments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ATLAS_API_KEY}`,
          "Idempotency-Key": `apple-anime-${revision}-${sourceHash.slice(0, 32)}`,
          ...transport.headers,
        },
        body: transport.body,
        cache: "no-store",
      });
    } catch {
      return fail(502, "upstream_error", "The isolated anime API is unavailable.");
    }

    let status = await readJson(response);
    if (!response.ok || !status) return upstreamResult(response, status);

    enrollmentId = typeof status.enrollment_id === "string" ? status.enrollment_id : "";
    const pollUrl = typeof status.poll_url === "string" ? status.poll_url : "";
    if (!enrollmentId || !pollUrl.startsWith("/v1/realtime/anime/enrollments/")) {
      return fail(502, "upstream_error", "Atlas returned an invalid enrollment handle.");
    }

    const deadline = Date.now() + timeoutMs();
    let pollAttempt = 0;
    while (status.realtime_ready !== true) {
      if (status.status === "failed") {
        return fail(422, "anime_enrollment_failed", "Anime portrait enrollment failed.");
      }
      if (Date.now() >= deadline) {
        return fail(504, "anime_enrollment_timeout", "Enrollment is still processing. Retry the same portrait later.");
      }
      // An idempotent enrollment POST can return its durable handle before the
      // status projection reflects a previously completed enrollment. Poll the
      // handle once immediately so warm/reused portraits do not pay an
      // artificial three-second startup floor. Only genuinely pending work uses
      // bounded backoff.
      if (pollAttempt > 0) {
        await sleep(Math.min(500 * 2 ** Math.min(pollAttempt - 1, 3), 3_000));
      }
      const pollResponse = await fetchEnrollmentStatus(`${ATLAS_ANIME_API_URL}${pollUrl}`, deadline);
      if (!pollResponse) {
        return fail(502, "upstream_error", "Atlas enrollment polling failed.");
      }
      response = pollResponse;
      status = await readJson(response);
      if (!response.ok || !status) return upstreamResult(response, status);
      pollAttempt += 1;
    }
    rememberEnrollment(cacheKey, enrollmentId);
  }

  try {
    response = await fetch(`${ATLAS_ANIME_API_URL}/v1/realtime/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ATLAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "passthrough",
        mouth_mode: "anime_realtime",
        anime_enrollment_id: enrollmentId,
      }),
      cache: "no-store",
    });
  } catch {
    return fail(502, "upstream_error", "Enrollment completed, but the anime session could not start.");
  }

  const data = await readJson(response);
  const result = upstreamResult(response, data);
  result.headers.set(
    "Server-Timing",
    `anime-enrollment-cache;desc=${enrollmentCacheHit ? "hit" : "miss"}`,
  );
  result.headers.set(
    "X-Atlas-Anime-Enrollment-Cache",
    enrollmentCacheHit ? "hit" : "miss",
  );
  return response.ok && typeof data?.session_id === "string"
    ? grant(result, "session", data.session_id)
    : result;
}
