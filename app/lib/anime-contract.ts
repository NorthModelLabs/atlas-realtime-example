// This demo proxies multipart uploads through a Vercel Function (4.5 MB body
// limit), unlike Atlas's direct 10 MiB API. Leave room for the multipart header
// and never advertise a portrait size the hosted proxy cannot deliver.
export { PORTRAIT_MAX_BYTES as ANIME_PORTRAIT_MAX_BYTES,
  PORTRAIT_LIMIT_MESSAGE as ANIME_PORTRAIT_LIMIT_MESSAGE } from "./demo-portrait";

export function animeReady(result: Record<string, unknown>, id: string): boolean {
  if (result.enrollment_id !== id) throw new Error("Enrollment identity changed.");
  // The public API maps completed durable jobs to status=ready. A success bool
  // cannot override failed/manual-review/unknown status or a foreign handle.
  if (result.status === "failed" || result.status === "manual_review") throw new Error("Anime portrait preparation failed.");
  if (result.status === "ready" && result.realtime_ready === true) return true;
  if (["queued", "processing", "publishing"].includes(String(result.status)) && result.realtime_ready === false) return false;
  throw new Error("Atlas returned an inconsistent enrollment status; no session was started.");
}
