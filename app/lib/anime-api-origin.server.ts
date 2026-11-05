/**
 * Keep the Atlas Demo Anime staging lane pinned to the staging namespace.
 * Staging must opt in by declaring its target and the exact in-cluster API
 * origin; there is deliberately no production-origin fallback.
 */
export const ATLAS_STAGING_ANIME_API_ORIGIN =
  "http://offline-api-staging.atlas-staging.svc.cluster.local:8200";
export const ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN = "http://127.0.0.1:18203";

type AnimeEnv = Record<string, string | undefined>;

/**
 * Permit the explicitly configured local port-forward used by staging review.
 * The exact loopback origin and target marker prevent this exception from
 * becoming a general local API override or a route to production.
 */
export function isAtlasStagingLocalTunnel(env: AnimeEnv): boolean {
  return env.NODE_ENV === "development"
    && env.ATLAS_ANIME_TARGET === "atlas_staging"
    && env.ATLAS_STAGING_LOCAL_TUNNEL === "true"
    && (env.ATLAS_API_URL || "").replace(/\/$/, "") === ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN
    && (env.ATLAS_ANIME_API_URL || "").replace(/\/$/, "") === ATLAS_STAGING_LOCAL_TUNNEL_ORIGIN;
}

export function resolveAnimeApiOrigin(env: AnimeEnv): string {
  const configured = (env.ATLAS_ANIME_API_URL || "").replace(/\/$/, "");
  const sessionOrigin = (env.ATLAS_API_URL || "").replace(/\/$/, "");

  // Local development must never inherit a public production URL from a dotenv
  // file. A misconfigured Apple UI should fail closed before submitting an
  // enrollment or session request to production.
  if (env.NODE_ENV === "development") {
    try {
      if ([configured, sessionOrigin].some((value) => value && new URL(value).hostname === "api.atlasv1.com")) return "";
    } catch {
      return "";
    }
  }

  if (env.ATLAS_ANIME_TARGET === "atlas_staging") {
    if (configured === ATLAS_STAGING_ANIME_API_ORIGIN && sessionOrigin === ATLAS_STAGING_ANIME_API_ORIGIN) {
      return sessionOrigin;
    }
    return isAtlasStagingLocalTunnel(env) ? sessionOrigin : "";
  }

  // The two UI modes may use different route handlers for enrollment and
  // session metadata, but both must reach the same API and unified renderer.
  // Omit ATLAS_ANIME_API_URL to inherit the session API; reject any split host.
  if (!sessionOrigin || (configured && configured !== sessionOrigin)) return "";
  return sessionOrigin;
}

export function animeStagingFlowEnabled(env: AnimeEnv): boolean {
  const apiOrigin = (env.ATLAS_API_URL || "").replace(/\/$/, "");
  const animeOrigin = resolveAnimeApiOrigin(env);
  const stagingOriginValid = apiOrigin === ATLAS_STAGING_ANIME_API_ORIGIN
    || isAtlasStagingLocalTunnel(env);
  return env.ATLAS_ANIME_TARGET === "atlas_staging"
    && env.ATLAS_ANIME_DEMO_ENABLED === "true"
    && env.ATLAS_ANIME_ENROLLMENT_ENABLED === "true"
    && env.ATLAS_ANIME_SESSION_ENABLED === "true"
    && stagingOriginValid
    && animeOrigin === apiOrigin;
}
