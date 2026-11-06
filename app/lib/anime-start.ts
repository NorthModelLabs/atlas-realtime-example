import { ANIME_PORTRAIT_MAX_BYTES, ANIME_PORTRAIT_LIMIT_MESSAGE, animeReady } from "./anime-contract";

function message(data: Record<string, unknown>, fallback: string) {
  const detail = data.detail;
  return typeof detail === "string" ? detail : typeof detail === "object" && detail !== null
    && "message" in detail && typeof detail.message === "string" ? detail.message
    : typeof data.message === "string" ? data.message : fallback;
}
async function read(response: Response) {
  if (response.status === 413) throw new Error(ANIME_PORTRAIT_LIMIT_MESSAGE);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Atlas returned an invalid response.");
  if (!response.ok) throw new Error(message(data as Record<string, unknown>, "Anime request failed."));
  return data as Record<string, unknown>;
}
// Called ONLY by explicit Start, never upload selection/effect. No portrait
// URL, staging fixture, new image-generation provider or automatic POST retry.
export async function startAnimeSession(face: File, progress: (text: string) => void, signal: AbortSignal) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(face.type) || !face.size || face.size > ANIME_PORTRAIT_MAX_BYTES) {
    throw new Error(ANIME_PORTRAIT_LIMIT_MESSAGE);
  }
  progress("Preparing anime portrait (may use the demo operator’s enrollment credits)…");
  const form = new FormData(); form.append("face", face);
  signal.throwIfAborted();
  // Do not abort a POST after submission and discard its enrollment ACK.
  // Cancellation prevents subsequent polling/start, not upstream billable work.
  let result = await read(await fetch("/api/anime/enrollment", { method: "POST", body: form }));
  const id = result.enrollment_id;
  if (typeof id !== "string" || !/^ae1\.[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(id)) throw new Error("Invalid enrollment handle.");
  const path = `/api/anime/enrollment/${encodeURIComponent(id)}`;
  const deadline = Date.now() + 30 * 60 * 1000;
  while (!animeReady(result, id)) {
    signal.throwIfAborted();
    if (Date.now() >= deadline) throw new Error("Portrait preparation is still pending; no session was started.");
    await new Promise<void>((resolve, reject) => {
      const aborted = () => { clearTimeout(timer); reject(new Error("Preparation wait cancelled; no new session will start.")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", aborted); resolve(); }, 3000);
      signal.addEventListener("abort", aborted, { once: true });
    });
    result = await read(await fetch(path, { cache: "no-store", signal }));
  }
  signal.throwIfAborted();
  progress("Portrait ready. Starting anime session…");
  // Preserve the session ACK even if UI disconnects now; the existing SDK
  // generation guard deletes the exact returned session on a stale connect.
  return read(await fetch(path, { method: "POST" }));
}
