// The hosted DEMO proxy has a 4.5 MB Vercel Function body cap, even though
// Atlas's direct API accepts 10 MiB. Do not silently resize/upload elsewhere.
export const PORTRAIT_MAX_BYTES = 4_000_000;
export const MULTIPART_MAX_BYTES = 4_250_000;
export const PORTRAIT_LIMIT_MESSAGE = "Use a PNG, JPEG or WebP portrait, up to 4 MB.";
export function portraitError(face: Blob): string | null {
  return !["image/png", "image/jpeg", "image/webp"].includes(face.type) || !face.size || face.size > PORTRAIT_MAX_BYTES
    ? PORTRAIT_LIMIT_MESSAGE : null;
}
export class PortraitInputError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function portraitForm(req: Request, allowed: readonly string[] = ["face"]): Promise<FormData> {
  const declared = req.headers.get("content-length");
  if (declared && (!/^[0-9]{1,8}$/.test(declared) || Number(declared) > MULTIPART_MAX_BYTES)) throw new PortraitInputError(413, PORTRAIT_LIMIT_MESSAGE);
  if (!req.body) throw new PortraitInputError(400, "No portrait upload provided.");
  const reader = req.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MULTIPART_MAX_BYTES) {
        // Cancellation failure must not hide the original size rejection.
        try { await reader.cancel(); } catch {}
        throw new PortraitInputError(413, PORTRAIT_LIMIT_MESSAGE);
      }
      chunks.push(new Uint8Array(chunk.value));
    }
  } finally { reader.releaseLock(); }
  const form = await new Response(new Blob(chunks), { headers: { "Content-Type": req.headers.get("content-type") || "" } }).formData();
  const keys = [...form.keys()];
  if (keys.length > allowed.length || keys.some(key => !allowed.includes(key)) || new Set(keys).size !== keys.length) {
    throw new PortraitInputError(400, "Upload one portrait with only the supported fields.");
  }
  return form;
}

export async function demoModeJSON(req: Request): Promise<Record<string, unknown>> {
  // The JSON fallback carries mode only, never an image or URL. Bound even a
  // chunked body before JSON.parse; malformed input must not fall back to {}.
  if (!req.body) return {};
  const declared = req.headers.get("content-length");
  if (declared && (!/^[0-9]{1,8}$/.test(declared) || Number(declared) > 16384)) throw new PortraitInputError(413, "Session options are too large.");
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16384) { try { await reader.cancel(); } catch {} throw new PortraitInputError(413, "Session options are too large."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset);offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
  catch { throw new PortraitInputError(400, "Session options must be a JSON object."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PortraitInputError(400, "Session options must be a JSON object.");
  return body as Record<string, unknown>;
}
