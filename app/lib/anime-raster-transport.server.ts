import { createHash } from "node:crypto";

// Send original PNG/WebP bytes through JSON when the paired API strict-raster
// validator is enabled. Never re-encode the image or alter its identity hash.
export function originalRasterEnvelope(bytes: Buffer, mime: string) {
  if (
    !Buffer.isBuffer(bytes)
    || bytes.length < 12
    || bytes.length > 4_000_000
    || !["image/png", "image/webp"].includes(mime)
  ) {
    throw new Error("ANIME_RAW_TRANSPORT_INVALID");
  }
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schema: "atlas.anime.raster-upload.v1",
      mime,
      image_base64: bytes.toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  };
}
