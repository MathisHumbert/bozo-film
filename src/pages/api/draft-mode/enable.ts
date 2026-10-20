export const prerender = false;

import { validatePreviewUrl } from "@sanity/preview-url-secret";
import type { APIRoute } from "astro";

import {
  enableDraftModeCookies,
  redirect,
} from "../../../lib/sanity/draft-mode";
import { sanityConfigured } from "../../../lib/sanity/load-query";

// Presentation calls this with a short-lived secret it has just written to the
// dataset. Reading it back needs a token, which is what proves the visitor came
// from a logged-in Studio rather than from a guessed URL.
export const GET: APIRoute = async ({ request }) => {
  const token = import.meta.env.SANITY_API_READ_TOKEN;

  if (!sanityConfigured || !token) {
    return new Response("Draft mode needs SANITY_API_READ_TOKEN.", {
      status: 500,
    });
  }

  const { sanityClient } = await import("sanity:client");

  const {
    isValid,
    redirectTo = "/",
    studioPreviewPerspective,
  } = await validatePreviewUrl(sanityClient.withConfig({ token }), request.url);

  if (!isValid) {
    return new Response("Invalid secret.", { status: 401 });
  }

  return redirect(
    redirectTo,
    enableDraftModeCookies(request, studioPreviewPerspective ?? "drafts"),
  );
};
