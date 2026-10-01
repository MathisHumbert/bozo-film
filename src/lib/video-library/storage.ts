import { S3Client } from "@aws-sdk/client-s3";

import { requireEnv, storageProvider } from "./env";

let client: S3Client | undefined;

/**
 * One client for both providers: R2 speaks the S3 API, so every command sent
 * elsewhere in the library works unchanged. Only the wiring differs.
 */
export function storageClient(): S3Client {
  if (client) {
    return client;
  }

  const credentials = {
    accessKeyId: requireEnv("STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("STORAGE_SECRET_ACCESS_KEY"),
  };

  client =
    storageProvider() === "r2"
      ? new S3Client({
          region: "auto",
          endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
          credentials,
          // R2 rejects the checksum headers the SDK adds by default since
          // v3.729 on presigned URLs. Only send them when the API requires it.
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
        })
      : new S3Client({ region: requireEnv("STORAGE_REGION"), credentials });

  return client;
}
