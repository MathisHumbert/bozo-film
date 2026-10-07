import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { storageBucket } from "./env";
import { storageClient } from "./storage";

/**
 * Every key is immutable — a new upload or a regenerated rendition always gets
 * a new one — so every object can be cached for good, by the CDN and by the
 * browser alike.
 */
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

const EXPIRES_IN = 600;

export interface SignedPut {
  uploadUrl: string;
  /** Headers the PUT must send verbatim, or the signature fails. */
  headers: Record<string, string>;
}

/**
 * Presigns a PUT for one object.
 *
 * `signableHeaders` is not optional here. A presigned URL only signs `host` by
 * default, so without it the caller could store any payload under any content
 * type — including text/html, which the CDN would then serve from our own
 * domain. Signing content-type makes the PUT fail unless it matches the type
 * the route validated.
 *
 * Cache-Control is signed for the same reason it is set here at all: it is
 * written on the object at upload time, from code, instead of living in a CDN
 * rule that drifts between environments.
 */
export async function signPut(
  key: string,
  contentType: string,
): Promise<SignedPut> {
  const uploadUrl = await getSignedUrl(
    storageClient(),
    new PutObjectCommand({
      Bucket: storageBucket(),
      Key: key,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    }),
    {
      expiresIn: EXPIRES_IN,
      signableHeaders: new Set(["content-type", "cache-control"]),
    },
  );

  return {
    uploadUrl,
    headers: { "content-type": contentType, "cache-control": CACHE_CONTROL },
  };
}
