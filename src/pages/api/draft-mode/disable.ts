export const prerender = false;

import type { APIRoute } from "astro";

import {
  disableDraftModeCookies,
  redirect,
} from "../../../lib/sanity/draft-mode";

export const GET: APIRoute = () => redirect("/", disableDraftModeCookies());
