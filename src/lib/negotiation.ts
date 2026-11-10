// Markdown content negotiation (RFC 9110 §12.5.1), run by `src/middleware.ts`.
// Both representations answer `Vary: Accept`, which the Workers Cache honours,
// so a Markdown body is never served to a browser from the cache.

export type Representation = "html" | "markdown";

// Page paths only: no file extension, nothing internal. `/llms.txt`, `/about.md`,
// `/_astro/*`, `/api/*` and the Studio are served as they are.
export const NEGOTIABLE_PATH =
  /^\/(?!(?:api|admin|_astro|_image|_server-islands)(?:\/|$))[^.]*$/;

// The cheap test; full q-value parsing then happens in `negotiate()`.
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
