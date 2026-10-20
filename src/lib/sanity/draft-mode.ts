import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";

const BYPASS_COOKIE = "__prerender_bypass";

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
  const partitioned = isFramed(request);
  const bypassToken = process.env.VERCEL_BYPASS_TOKEN;

  return [
    cookie(perspectiveCookieName, perspective, partitioned),
    ...(bypassToken ? [cookie(BYPASS_COOKIE, bypassToken, partitioned)] : []),
  ];
}

export function disableDraftModeCookies(): string[] {
  return [perspectiveCookieName, BYPASS_COOKIE].flatMap((name) => [
    cookie(name, "", false, 0),
    cookie(name, "", true, 0),
  ]);
}

export function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
  });

  for (const value of cookies) headers.append("Set-Cookie", value);

  return new Response(null, { status: 307, headers });
}
