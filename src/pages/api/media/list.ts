import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { storageBucket, storagePrefix } from "../../../lib/video-library/env";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import { storageClient } from "../../../lib/video-library/storage";

export const prerender = false;

export interface StoredObject {
  key: string;
  size: number;
  lastModified: string | null;
}

/**
 * Lists what actually sits in the bucket.
 *
 * The library UI never calls this: it reads Sanity documents, because the
 * bucket is storage, not a database. This route exists for the reconciliation
 * screen — finding objects with no document, and documents whose object is
 * gone — and for tests.
 */
export const GET: APIRoute = async ({ request }) => {
  const user = await requireStudioUser(request);
  if (!user) {
    return unauthorized(request);
  }

  const prefix = storagePrefix();
  const objects: StoredObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await storageClient().send(
      new ListObjectsV2Command({
        Bucket: storageBucket(),
        Prefix: prefix ? `${prefix}/` : undefined,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of response.Contents ?? []) {
      // Skip the zero-byte markers the S3 console creates for folders.
      if (!item.Key || item.Key.endsWith("/")) {
        continue;
      }

      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified?.toISOString() ?? null,
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return json({ count: objects.length, objects }, 200, request);
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
