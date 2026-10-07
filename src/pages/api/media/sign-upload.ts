import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { videoUrl } from "../../../lib/video-library/cdn";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import { buildVideoKey } from "../../../lib/video-library/keys";
import { signPut } from "../../../lib/video-library/sign";

export const prerender = false;

const MAX_SIZE = 500 * 1024 * 1024;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const POST: APIRoute = async ({ request }) => {
  const user = await requireStudioUser(request);
  if (!user) {
    return unauthorized(request);
  }

  const body = (await request.json().catch(() => null)) as {
    filename?: string;
    contentType?: string;
    size?: number;
  } | null;

  if (!body?.filename || !body.contentType) {
    return json(
      { error: "filename and contentType are required" },
      400,
      request,
    );
  }

  if (!ALLOWED_TYPES.includes(body.contentType)) {
    return json(
      { error: `Unsupported content type: ${body.contentType}` },
      415,
      request,
    );
  }

  if (typeof body.size !== "number" || body.size <= 0 || body.size > MAX_SIZE) {
    return json({ error: `Invalid size, max ${MAX_SIZE} bytes` }, 413, request);
  }

  const key = buildVideoKey(body.filename);

  // The browser PUTs straight to the bucket, so the file never transits
  // through this server and uploads are not bounded by any body-size limit.
  const { uploadUrl, headers } = await signPut(key, body.contentType);

  return json({ key, uploadUrl, headers, cdnUrl: videoUrl(key) }, 200, request);
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
