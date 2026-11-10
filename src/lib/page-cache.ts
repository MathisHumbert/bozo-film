// What the Workers Cache keeps, and how it is found again. Shared by the
// middleware, which tags each page as it is stored, and `/api/revalidate`,
// which purges by the same tags. Imports nothing.

// Kept until the Sanity webhook purges it, like ISR. The year is only a
// ceiling: a missed webhook heals at the next deploy, since the Worker version
// is part of the cache key.
export const PAGE_CACHE_SECONDS = 60 * 60 * 24 * 365;

// `/about` and `/about/` are both served (trailingSlash: "ignore") and cached
// apart, so the tag drops the slash: one purge reaches both entries, and every
// Accept variant of each.
export function pageTag(pathname: string): string {
  return `page:${pathname.replace(/\/+$/, "") || "/"}`;
}

// Pages, their Markdown twins and the llms files. The API routes declare no
// cache intent, which the adapter turns into `no-store`.
export function isCacheable(pathname: string): boolean {
  return !/^\/api(?:\/|$)/.test(pathname);
}
