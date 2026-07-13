export const VALID_MODES = new Set(["passthrough"]);
export const VALID_MODEL_VARIANTS = new Set(["test5", "latest"]);

export function atlasSessionUrl(sessionId?: string, suffix = "") {
  const configuredUrl = process.env.ATLAS_API_URL || "";
  const trimmedUrl = configuredUrl.replace(/\/+$/, "");
  const sessionEndpoint = /\/v1\/[^/]+\/session$/.test(trimmedUrl)
    ? trimmedUrl
    : `${trimmedUrl}/v1/realtime/session`;
  return `${sessionEndpoint}${sessionId ? `/${encodeURIComponent(sessionId)}` : ""}${suffix}`;
}

export function atlasHeaders(modelVariant?: string, contentType?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.ATLAS_API_KEY || ""}`,
  };
  if (contentType) headers["Content-Type"] = contentType;
  if (modelVariant) headers["X-Model-Variant"] = modelVariant;
  return headers;
}

export function getModelVariant(value: FormDataEntryValue | null | undefined) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return process.env.ATLAS_MODEL_VARIANT || "";
}
