import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";

// One cookie. The Workers Cache cannot be told to skip a request by cookie, so
// the pages answer `Vary: Cookie` (src/middleware.ts): a browser carrying this
// one never shares a cache entry with a visitor, and its draft responses are
// never stored.
function cookie(
  name: string,
  value: string,
  partitioned: boolean,
  maxAge?: number,
) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=None",
    "Secure",
    ...(partitioned ? ["Partitioned"] : []),
    ...(maxAge !== undefined ? [`Max-Age=${maxAge}`] : []),
  ].join("; ");
}

export function isFramed(request: Request): boolean {
  return (
    request.headers.get("sec-fetch-dest") === "iframe" &&
    request.headers.get("sec-fetch-site") === "cross-site"
  );
}

export function enableDraftModeCookies(
  request: Request,
  perspective: string,
): string[] {
  return [cookie(perspectiveCookieName, perspective, isFramed(request))];
}

export function disableDraftModeCookies(): string[] {
  return [
    cookie(perspectiveCookieName, "", false, 0),
    cookie(perspectiveCookieName, "", true, 0),
  ];
}

export function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
  });

  for (const value of cookies) headers.append("Set-Cookie", value);

  return new Response(null, { status: 307, headers });
}
