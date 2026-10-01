export const prerender = false;

import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";
import type { APIRoute } from "astro";

import { allPaths, hrefFor, isRoutable } from "../../lib/routes";

interface WebhookDoc {
  _type?: string;
  slug?: string;
}

const AI_PATHS = ["/llms.txt", "/llms-full.txt"];

const SITE_WIDE_TYPES = ["settings", "video-asset"];

async function resolvePaths(doc: WebhookDoc): Promise<string[]> {
  const type = doc._type;

  if (SITE_WIDE_TYPES.includes(type ?? "")) {
    return [...allPaths(), ...AI_PATHS];
  }

  if (!isRoutable(type)) return [];

  const paths = new Set(AI_PATHS);

  const own = hrefFor(doc);

  if (own) {
    paths.add(own);
  }

  return [...paths];
}

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.SANITY_REVALIDATE_SECRET;
  const bypassToken = process.env.VERCEL_BYPASS_TOKEN;

  if (!secret || !bypassToken) {
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

  const origin = new URL(request.url).origin;

  const results = await Promise.allSettled(
    paths.map((path) =>
      fetch(`${origin}${path}`, {
        method: "HEAD",
        headers: { "x-prerender-revalidate": bypassToken },
      }),
    ),
  );

  const revalidated = paths.filter((_, i) => results[i].status === "fulfilled");

  return new Response(
    JSON.stringify({ revalidated: true, type: doc._type, paths: revalidated }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
