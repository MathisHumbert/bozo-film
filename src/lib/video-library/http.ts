import { optionalEnv } from "./env";

/**
 * Origins allowed to call the media API, beyond the site's own.
 *
 * Only needed when the Studio is served somewhere else — `sanity dev` on :3333,
 * or a deployed `*.sanity.studio`. An empty list means same-origin only, which
 * is the safer default.
 */
function allowedOrigins(): string[] {
  return optionalEnv("STUDIO_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("origin");

  if (!origin || !allowedOrigins().includes(origin)) return {};

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    // The response differs per origin, so it must never be cached for another.
    vary: "origin",
  };
}

export function json(data: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders(request),
    },
  });
}

export const unauthorized = (request?: Request) =>
  json({ error: "Unauthorized" }, 401, request);

/** Answers the browser's preflight for an allowed origin. */
export function preflight(request: Request): Response {
  const headers = corsHeaders(request);

  return new Response(null, {
    status: Object.keys(headers).length > 0 ? 204 : 403,
    headers,
  });
}
