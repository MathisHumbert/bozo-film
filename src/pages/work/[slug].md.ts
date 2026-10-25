export const prerender = false;

import type { APIRoute } from "astro";

import { markdownResponse } from "../../lib/markdown-endpoint";

// Needed beside `[...path].md.ts`: `[slug].astro` would otherwise take
// `/work/<slug>.md` with the extension in the slug.
export const GET: APIRoute = ({ params, site }) =>
  markdownResponse(`/work/${params.slug}`, site);
