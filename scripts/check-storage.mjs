import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const provider = env.STORAGE_PROVIDER ?? "s3";

const required = [
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "PUBLIC_CDN_URL",
  provider === "r2" ? "R2_ACCOUNT_ID" : "STORAGE_REGION",
];

const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error(`❌ env      missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`✅ env      provider "${provider}", all variables present`);

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
        // R2 rejects the checksum headers the SDK adds by default since
        // v3.729 on presigned URLs. Only send them when the API requires it.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : new S3Client({ region: env.STORAGE_REGION, credentials });

const prefix = (env.STORAGE_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
// A fresh key on every run, so we never hit a 403 CloudFront cached earlier.
const name = `_healthcheck-${Date.now()}.txt`;
const key = prefix ? `${prefix}/${name}` : name;
const body = `ok ${new Date().toISOString()}`;

let uploaded = false;

try {
  await client.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    }),
  );
  uploaded = true;
  console.log(`✅ PUT      ${key}`);

  const cdnUrl = `${env.PUBLIC_CDN_URL.replace(/\/+$/, "")}/${key}`;
  const response = await fetch(cdnUrl, { cache: "no-store" });
  const text = await response.text();

  if (!response.ok) {
    console.error(`❌ CDN      ${response.status} on ${cdnUrl}`);
    console.error("   → missing OAC bucket policy, or wrong origin bucket.");
    process.exitCode = 1;
  } else if (text.trim() !== body) {
    console.error("❌ CDN      unexpected body");
    process.exitCode = 1;
  } else {
    console.log(`✅ CDN      read OK through ${env.PUBLIC_CDN_URL}`);
  }
} catch (error) {
  console.error(`❌ ${provider.toUpperCase()}       ${error.message}`);
  process.exitCode = 1;
} finally {
  if (uploaded) {
    await client
      .send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }))
      .then(() => console.log("✅ DELETE   cleanup OK"))
      .catch((error) => console.error(`❌ DELETE   ${error.message}`));
  }
}
