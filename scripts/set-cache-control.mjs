/**
 * Writes the immutable Cache-Control header on every object already in the
 * library's prefix.
 *
 * New uploads get it at PUT time (`src/lib/video-library/sign.ts`). Objects
 * stored before that have none, and S3 cannot edit metadata in place: each
 * object is copied onto itself with the new header. The copy happens inside
 * the bucket — nothing is downloaded.
 *
 * Dry run by default; pass --apply to write.
 *   node scripts/set-cache-control.mjs [--apply]
 */
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { loadEnv } from "vite";

// Keep in step with CACHE_CONTROL in src/lib/video-library/sign.ts.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const apply = process.argv.includes("--apply");
const env = loadEnv("development", process.cwd(), "");
const provider = env.STORAGE_PROVIDER ?? "s3";
const bucket = env.STORAGE_BUCKET;

const credentials = {
  accessKeyId: env.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
};

const client =
  provider === "r2"
    ? new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : new S3Client({ region: env.STORAGE_REGION, credentials });

const prefix = (env.STORAGE_PREFIX ?? "").replace(/^\/+|\/+$/g, "");

const keys = [];
let continuationToken;

do {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix ? `${prefix}/` : undefined,
      ContinuationToken: continuationToken,
    }),
  );

  for (const item of response.Contents ?? []) {
    if (item.Key && !item.Key.endsWith("/")) {
      keys.push(item.Key);
    }
  }

  continuationToken = response.IsTruncated
    ? response.NextContinuationToken
    : undefined;
} while (continuationToken);

console.log(
  `\n${keys.length} object(s) under "${prefix || "(bucket root)"}"${apply ? "" : " — dry run"}\n`,
);

let changed = 0;

for (const key of keys) {
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (head.CacheControl === CACHE_CONTROL) {
    console.log(`·  ${key}`);
    continue;
  }

  changed += 1;

  if (!apply) {
    console.log(`→  ${key}  (${head.CacheControl ?? "no cache-control"})`);
    continue;
  }

  // REPLACE drops every header not restated, so the content type and any
  // user metadata are carried over explicitly.
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
      MetadataDirective: "REPLACE",
      ContentType: head.ContentType,
      Metadata: head.Metadata,
      CacheControl: CACHE_CONTROL,
    }),
  );

  console.log(`✅ ${key}`);
}

console.log(
  apply
    ? `\n${changed} object(s) updated.\n`
    : `\n${changed} object(s) would change. Run with --apply to write.\n`,
);
