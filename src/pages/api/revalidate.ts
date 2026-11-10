export const prerender = false;

import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";
import type { APIRoute } from "astro";

import { serverEnv } from "../../lib/env";
import { markdownPathFor } from "../../lib/negotiation";
import { pageTag } from "../../lib/page-cache";
import { allPaths, hrefFor, isRoutable } from "../../lib/routes";

interface WebhookDoc {
  _type?: string;
  slug?: string;
}

const AI_PATHS = ["/llms.txt", "/llms-full.txt"];

const SITE_WIDE_TYPES = ["settings", "video-asset", "work", "about", "photo"];

// Every page has a Markdown twin at `<path>.md`, cached on its own.
function withMarkdown(paths: string[]): string[] {
  return paths.flatMap((path) => [path, markdownPathFor(path)]);
}

export async function resolvePaths(doc: WebhookDoc): Promise<string[]> {
  const type = doc._type;
  const own = isRoutable(type) ? hrefFor(doc) : null;

  if (SITE_WIDE_TYPES.includes(type ?? "")) {
    return [
      ...new Set([
        ...withMarkdown([...allPaths(), ...(own ? [own] : [])]),
        ...AI_PATHS,
      ]),
    ];
  }

  if (!isRoutable(type)) return [];

  const paths = new Set(AI_PATHS);

  if (own) {
    for (const path of withMarkdown([own])) paths.add(path);
  }

  return [...paths];
}

export const POST: APIRoute = async ({ request, cache }) => {
  const secret = serverEnv("SANITY_REVALIDATE_SECRET");

  if (!secret) {
    return new Response(
      JSON.stringify({ message: "Missing server configuration" }),
      { status: 500 },
    );
  }

  const signature = request.headers.get(SIGNATURE_HEADER_NAME) ?? "";
  const body = await request.text();

  if (!(await isValidSignature(body, signature, secret))) {
    return new Response(JSON.stringify({ message: "Invalid signature" }), {
      status: 401,
    });
  }

  let doc: WebhookDoc;

  try {
    doc = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ message: "Bad Request" }), {
      status: 400,
    });
  }

  const paths = await resolvePaths(doc);

  if (paths.length === 0) {
    return new Response(
      JSON.stringify({
        revalidated: false,
        message: "No path for type",
        type: doc._type,
      }),
      { status: 200 },
    );
  }

  // One purge for every path: the middleware tagged each page with
  // `pageTag()` as the Workers Cache stored it. Global, and a no-op in dev.
  try {
    await cache.invalidate({ tags: [...new Set(paths.map(pageTag))] });
  } catch (error) {
    return new Response(
      JSON.stringify({
        revalidated: false,
        message: error instanceof Error ? error.message : "Purge failed",
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ revalidated: true, type: doc._type, paths }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
