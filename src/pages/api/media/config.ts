import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { videoUrl } from "../../../lib/video-library/cdn";
import {
  cdnBaseUrl,
  storageBucket,
  storagePrefix,
  storageProvider,
} from "../../../lib/video-library/env";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import { buildVideoKey } from "../../../lib/video-library/keys";

export const prerender = false;

/**
 * Diagnostic route: what the server resolved from the environment, plus a
 * freshly generated key so the caller can see the naming scheme in action.
 *
 * Behind the auth guard because it names the bucket.
 */
export const GET: APIRoute = async ({ request }) => {
  const user = await requireStudioUser(request);
  if (!user) {
    return unauthorized(request);
  }

  const sampleKey = buildVideoKey("Ma Vidéo de Test.MOV");

  return json(
    {
      provider: storageProvider(),
      bucket: storageBucket(),
      prefix: storagePrefix() || "(bucket root)",
      cdn: cdnBaseUrl(),
      sampleKey,
      sampleUrl: videoUrl(sampleKey),
    },
    200,
    request,
  );
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
