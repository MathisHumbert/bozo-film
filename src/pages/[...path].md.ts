export const prerender = false;

import type { APIRoute } from "astro";

import { markdownResponse } from "../lib/markdown-endpoint";
import { pagePathFor } from "../lib/negotiation";

// `/index.md`, `/about.md`, `/photo.md`, and the Markdown 404 for any path that
// is not a page. Reached directly, or through the middleware for
// `Accept: text/markdown`. `/work/<slug>.md` has its own route.
export const GET: APIRoute = ({ params, site }) =>
  markdownResponse(pagePathFor(params.path), site);
