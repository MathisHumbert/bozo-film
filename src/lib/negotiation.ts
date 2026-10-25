// Markdown content negotiation (RFC 9110 §12.5.1). Imports nothing, on purpose:
// `astro.config.mjs` reads it at build time to write the Vercel route, and the
// middleware reads it at request time, so the two can never disagree about which
// requests are negotiated. If they did, a Markdown body could reach the ISR
// function and be cached as the HTML page.

export type Representation = "html" | "markdown";

// Page paths only: no file extension, nothing internal. `/llms.txt`, `/about.md`,
// `/_astro/*`, `/api/*` and the Studio are served as they are.
export const NEGOTIABLE_PATH =
  /^\/(?!(?:api|admin|_astro|_image|_server-islands|_isr|_render|_vercel)(?:\/|$))[^.]*$/;

// The cheap test, shared with the Vercel route. Only these requests leave the
// ISR cache; full q-value parsing then happens in `negotiate()`.
export const MARKDOWN_ACCEPT = /text\/markdown/i;

export function isNegotiable(pathname: string): boolean {
  return NEGOTIABLE_PATH.test(pathname);
}

export function mentionsMarkdown(accept?: string | null): boolean {
  return MARKDOWN_ACCEPT.test(accept ?? "");
}

interface MediaRange {
  type: string;
  subtype: string;
  q: number;
}

function parseAccept(accept: string): MediaRange[] {
  return accept.split(",").flatMap((part) => {
    const [range, ...params] = part.split(";").map((value) => value.trim());
    const [type, subtype] = range.toLowerCase().split("/");

    if (!type || !subtype) return [];

    const qParam = params.find((param) => /^q\s*=/i.test(param));
    const q = qParam ? Number(qParam.split("=")[1]) : 1;

    return [{ type, subtype, q: Number.isFinite(q) ? q : 0 }];
  });
}

// The q-value of the most specific range matching `mediaType`: exact beats
// `type/*`, which beats `*/*`. No match means not acceptable.
function qualityOf(ranges: MediaRange[], mediaType: string): number {
  const [type, subtype] = mediaType.split("/");

  const exact = ranges.find((r) => r.type === type && r.subtype === subtype);
  if (exact) return exact.q;

  const partial = ranges.find((r) => r.type === type && r.subtype === "*");
  if (partial) return partial.q;

  const any = ranges.find((r) => r.type === "*" && r.subtype === "*");
  if (any) return any.q;

  return 0;
}

// `null` means neither is acceptable: answer 406. On a tie Markdown wins, since
// the client named it.
export function negotiate(accept?: string | null): Representation | null {
  if (!accept?.trim()) return "html";

  const ranges = parseAccept(accept);
  const html = qualityOf(ranges, "text/html");
  const markdown = qualityOf(ranges, "text/markdown");

  if (html <= 0 && markdown <= 0) return null;

  return markdown >= html ? "markdown" : "html";
}

// `/` → `/index.md`, `/work/aurora/` → `/work/aurora.md`.
export function markdownPathFor(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");

  return `${trimmed || "/index"}.md`;
}

// The inverse, for the `.md` endpoint: `index` → `/`, `work/aurora` → `/work/aurora`.
export function pagePathFor(param?: string | null): string {
  const trimmed = (param ?? "").replace(/^\/+|\/+$/g, "");

  return trimmed === "index" || trimmed === "" ? "/" : `/${trimmed}`;
}

export const VARY = "Accept";

export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

// ——— Vercel routing ———

interface VercelRoute {
  src?: string;
  dest?: string;
  handle?: string;
  has?: { type: string; key: string; value?: string }[];
  [key: string]: unknown;
}

interface VercelConfig {
  routes?: VercelRoute[];
  [key: string]: unknown;
}

// Header values are matched as a regex. Spelled out as character classes rather
// than an inline `(?i)` flag, whose support the routing layer does not document.
function caseInsensitive(value: string): string {
  return value.replace(/[a-z]/gi, (char) =>
    char.toLowerCase() === char.toUpperCase()
      ? char
      : `[${char.toLowerCase()}${char.toUpperCase()}]`,
  );
}

export const MARKDOWN_ROUTE: VercelRoute = {
  src: NEGOTIABLE_PATH.source.replace(/\\\//g, "/"),
  has: [
    {
      type: "header",
      key: "accept",
      value: `.*${caseInsensitive("text/markdown")}.*`,
    },
  ],
  // `_render` is the uncached function. The middleware negotiates there.
  dest: "_render",
};

// Inserted straight after `handle: filesystem`, so above every page route and
// therefore above the ISR cache. Idempotent.
export function withMarkdownRoute(config: VercelConfig): VercelConfig {
  const routes = (config.routes ?? []).filter(
    (route) => route.dest !== MARKDOWN_ROUTE.dest || !route.has,
  );
  const filesystem = routes.findIndex((route) => route.handle === "filesystem");

  if (filesystem === -1) {
    throw new Error(
      "No `handle: filesystem` in .vercel/output/config.json: the Markdown route has nowhere to go.",
    );
  }

  routes.splice(filesystem + 1, 0, MARKDOWN_ROUTE);

  return { ...config, routes };
}
