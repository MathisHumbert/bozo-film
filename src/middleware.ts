import { defineMiddleware } from "astro:middleware";
import type { APIContext } from "astro";

import {
  isNegotiable,
  markdownPathFor,
  mentionsMarkdown,
  negotiate,
  VARY,
} from "./lib/negotiation";
import { isCacheable, PAGE_CACHE_SECONDS, pageTag } from "./lib/page-cache";
import { isDraftMode } from "./lib/sanity/load-query";

// Two jobs, in this order: Markdown content negotiation for every page, then
// telling Cloudflare's Workers Cache what to keep.
//
// The cache sits in front of the Worker and keys on the path, plus every header
// a response names in `Vary`. So the negotiation needs nothing special: both
// representations carry `Vary: Accept` and are stored apart. Draft mode is the
// same trick with `Vary: Cookie`, since the cache cannot be told to skip a
// request by cookie: an editor's browser never matches a visitor's entry, and
// its own draft responses are never stored.

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await negotiated(context, next);

  return cached(context, response);
});

async function negotiated(
  context: APIContext,
  next: () => Promise<Response>,
): Promise<Response> {
  const { pathname } = context.url;

  if (!isNegotiable(pathname)) return next();

  const accept = context.request.headers.get("accept");

  if (mentionsMarkdown(accept)) {
    const choice = negotiate(accept);

    if (choice === null) {
      return new Response(
        "Not Acceptable. Available: text/html, text/markdown\n",
        {
          status: 406,
          headers: { "content-type": "text/plain; charset=utf-8", vary: VARY },
        },
      );
    }

    if (choice === "markdown") {
      return withVary(await context.rewrite(markdownPathFor(pathname)), VARY);
    }
  }

  return withVary(await next(), VARY);
}

// `cache.enabled` is false in `astro dev`: nothing is stored locally.
function cached(context: APIContext, response: Response): Response {
  const { cache, url, request } = context;

  if (!cache?.enabled || !isCacheable(url.pathname)) return response;
  if (request.method !== "GET" && request.method !== "HEAD") return response;

  // A 404 stays out too: publishing that slug must not wait for a purge.
  if (response.status !== 200 || isDraftMode(context.cookies)) {
    cache.set(false);

    return response;
  }

  cache.set({ maxAge: PAGE_CACHE_SECONDS, tags: [pageTag(url.pathname)] });

  return withVary(response, "Cookie");
}

// Appends to any Vary already there.
function withVary(response: Response, value: string): Response {
  const current = response.headers.get("vary");

  const listed = (current ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase());

  if (listed.includes(value.toLowerCase()) || listed.includes("*")) {
    return response;
  }

  const next = current ? `${current}, ${value}` : value;

  try {
    response.headers.set("vary", next);

    return response;
  } catch {
    // Immutable headers: copy the response.
    const headers = new Headers(response.headers);
    headers.set("vary", next);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
