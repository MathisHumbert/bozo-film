/**
 * Configuration shared by both Studios.
 *
 * The Studio runs embedded at `/admin`, built by Astro, and standalone under
 * `sanity dev`. Astro only exposes `PUBLIC_*` to the browser; the Studio's own
 * Vite build is told to do the same in `sanity.cli.ts`, so one set of variables
 * serves both. `process.env` is the fallback for the Sanity CLI, which
 * evaluates this in Node where nothing is inlined.
 */
function read(name: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;

  return (
    env?.[name] ||
    (typeof process !== "undefined" ? process.env?.[name] : undefined) ||
    undefined
  );
}

export const projectId = () => read("PUBLIC_SANITY_PROJECT_ID") ?? "";

export const dataset = () => read("PUBLIC_SANITY_DATASET") ?? "production";

export const cdnUrl = () => read("PUBLIC_CDN_URL") ?? "";

/**
 * Where the site lives. Embedded in the site there is nothing to configure, so
 * the current origin is right. Standalone, it has to be told.
 */
export function siteUrl(): string {
  const configured = read("PUBLIC_SITE_URL");

  if (configured) return configured.replace(/\/+$/, "");

  return typeof location !== "undefined" ? location.origin : "";
}

/** Relative when same-origin, absolute when the Studio is served elsewhere. */
export function mediaApiBasePath(): string {
  const site = siteUrl();
  const sameOrigin =
    typeof location !== "undefined" && site === location.origin;

  return sameOrigin || !site ? "/api/media" : `${site}/api/media`;
}
