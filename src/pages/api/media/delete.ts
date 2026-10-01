import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { storageBucket } from "../../../lib/video-library/env";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import { isManagedKey } from "../../../lib/video-library/keys";
import { storageClient } from "../../../lib/video-library/storage";

export const prerender = false;

// The S3 DeleteObjects API caps a batch at 1000 keys.
const MAX_KEYS = 1000;

export const POST: APIRoute = async ({ request }) => {
  const user = await requireStudioUser(request);
  if (!user) {
    return unauthorized(request);
  }

  const body = (await request.json().catch(() => null)) as {
    keys?: unknown;
  } | null;

  const keys = Array.isArray(body?.keys) ? body.keys : [];

  if (!keys.length) {
    return json({ error: "keys is required" }, 400, request);
  }

  if (keys.length > MAX_KEYS) {
    return json({ error: `Too many keys, max ${MAX_KEYS}` }, 400, request);
  }

  // The IAM policy reaches the whole bucket, so this guard is the only thing
  // keeping a delete request inside the library's own namespace. Never drop it.
  const rejected = keys.filter((key) => !isManagedKey(key));

  if (rejected.length) {
    return json(
      { error: "Key outside the managed prefix", rejected },
      400,
      request,
    );
  }

  const response = await storageClient().send(
    new DeleteObjectsCommand({
      Bucket: storageBucket(),
      Delete: {
        Objects: (keys as string[]).map((Key) => ({ Key })),
        Quiet: true,
      },
    }),
  );

  const failed = (response.Errors ?? []).map((error) => ({
    key: error.Key,
    reason: error.Message,
  }));

  return json({ deleted: keys.length - failed.length, failed }, 200, request);
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
