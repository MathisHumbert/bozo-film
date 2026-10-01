import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { videoUrl } from "../../../lib/video-library/cdn";
import { storageBucket } from "../../../lib/video-library/env";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import { buildVideoKey } from "../../../lib/video-library/keys";
import { storageClient } from "../../../lib/video-library/storage";

export const prerender = false;

const MAX_SIZE = 500 * 1024 * 1024;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const EXPIRES_IN = 600;

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
    );
  }

  if (typeof body.size !== "number" || body.size <= 0 || body.size > MAX_SIZE) {
    return json({ error: `Invalid size, max ${MAX_SIZE} bytes` }, 413, request);
  }

  const key = buildVideoKey(body.filename);

  // The browser PUTs straight to the bucket, so the file never transits
  // through this server and uploads are not bounded by any body-size limit.
  //
  // `signableHeaders` is not optional here. A presigned URL only signs `host`
  // by default, so without it the caller could store any payload under any
  // content type — including text/html, which the CDN would then serve from
  // our own domain. Signing content-type makes the PUT fail unless it matches
  // the type we just validated.
  const uploadUrl = await getSignedUrl(
    storageClient(),
    new PutObjectCommand({
      Bucket: storageBucket(),
      Key: key,
      ContentType: body.contentType,
    }),
    { expiresIn: EXPIRES_IN, signableHeaders: new Set(["content-type"]) },
  );

  return json({ key, uploadUrl, cdnUrl: videoUrl(key) }, 200, request);
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
