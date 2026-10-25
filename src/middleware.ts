import { defineMiddleware } from "astro:middleware";

import {
  isNegotiable,
  markdownPathFor,
  mentionsMarkdown,
  negotiate,
  VARY,
} from "./lib/negotiation";

// Markdown content negotiation for every page. On Vercel this only ever decides
// anything inside the uncached `_render` function: the route written by
// `withMarkdownRoute()` sends every request whose Accept mentions text/markdown
// there, so the ISR function never sees one and cannot cache a Markdown body
// under an HTML URL. Locally it runs on every request, which is the same thing.

export const onRequest = defineMiddleware(async (context, next) => {
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
      return withVary(await context.rewrite(markdownPathFor(pathname)));
    }
  }

  return withVary(await next());
});

// Both representations carry it, so any cache downstream keys on Accept.
function withVary(response: Response): Response {
  const current = response.headers.get("vary");

  const listed = (current ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase());

  if (listed.includes("accept") || listed.includes("*")) return response;

  try {
    response.headers.set("vary", current ? `${current}, ${VARY}` : VARY);

    return response;
  } catch {
    // Immutable headers: copy the response.
    const headers = new Headers(response.headers);
    headers.set("vary", current ? `${current}, ${VARY}` : VARY);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
