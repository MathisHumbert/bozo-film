export const prerender = false;

import type { APIRoute } from "astro";

import { loadQuery } from "../lib/sanity/load-query";
import { llmsQuery } from "../lib/sanity/queries";
import { renderLlmsFull } from "../lib/seo/llms";
import { originOf, textResponse } from "../lib/seo/text-endpoint";

export const GET: APIRoute = async ({ site }) => {
  const data = await loadQuery(llmsQuery, {}, { stega: false });

  if (!data) return new Response(null, { status: 404 });

  return textResponse(renderLlmsFull(data, originOf(site)));
};
