/**
 * End-to-end check of the /api/media routes.
 *
 * It signs an upload, PUTs a payload straight to the bucket, reads it back
 * through the CDN, then deletes it and proves it is gone. Anything it creates
 * it also removes, so it is safe to run as often as you like.
 *
 * The dev server must be running. Point it elsewhere with:
 *   BASE_URL=https://your-site.com node scripts/check-media-api.mjs
 */
import { randomBytes } from "node:crypto";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

// Any token the Sanity project accepts works as a caller identity. The read
// token already in .env saves copying a session token out of the Studio.
const token = env.SANITY_API_READ_TOKEN;

if (!token) {
  console.error("❌ SANITY_API_READ_TOKEN is required in .env");
  process.exit(1);
}

let failures = 0;

function check(label, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(42)} ${detail}`);
  if (!ok) {
    failures += 1;
  }
}

const api = (path, { auth = true, ...init } = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(auth ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

const sign = (payload, options) =>
  api("/api/media/sign-upload", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });

console.log(`\n→ ${baseUrl}\n`);

// --- auth ---------------------------------------------------------------

const anonymous = await sign(
  { filename: "a.mp4", contentType: "video/mp4", size: 1000 },
  { auth: false },
);
check("sign-upload without a token", anonymous.status === 401, "401 expected");

const badToken = await sign(
  { filename: "a.mp4", contentType: "video/mp4", size: 1000 },
  { headers: { authorization: "Bearer nope" } },
);
check("sign-upload with an invalid token", badToken.status === 401);

const config = await api("/api/media/config");
check("config with a valid token", config.status === 200);

const configAnonymous = await api("/api/media/config", { auth: false });
check("config without a token", configAnonymous.status === 401);

// --- validation ---------------------------------------------------------

const wrongType = await sign({
  filename: "a.gif",
  contentType: "image/gif",
  size: 1000,
});
check("rejects a non-video content type", wrongType.status === 415);

const tooBig = await sign({
  filename: "a.mp4",
  contentType: "video/mp4",
  size: 999_999_999,
});
check("rejects an oversized file", tooBig.status === 413);

const incomplete = await sign({ filename: "a.mp4" });
check("rejects a missing content type", incomplete.status === 400);

// --- signing ------------------------------------------------------------

const payload = randomBytes(200_000);

const signed = await sign({
  filename: "API healthcheck.mp4",
  contentType: "video/mp4",
  size: payload.byteLength,
});

check("signs a valid upload", signed.status === 200);

if (signed.status !== 200) {
  console.error("\nCannot continue without a signed URL.\n");
  process.exit(1);
}

const { key, uploadUrl, cdnUrl } = await signed.json();

const signedHeaders =
  new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders") ?? "";

check(
  "signature covers content-type",
  signedHeaders.includes("content-type"),
  signedHeaders,
);

// --- upload -------------------------------------------------------------

const tampered = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "content-type": "text/plain" },
  body: payload,
});

// Without a signed content-type this would return 200 and the CDN would serve
// whatever type the caller chose — text/html included.
check(
  "rejects a PUT with a mismatched type",
  tampered.status === 403,
  `${tampered.status} received`,
);

const upload = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "content-type": "video/mp4" },
  body: payload,
});

check("uploads through the presigned URL", upload.ok, key);

// --- delivery -----------------------------------------------------------

const delivered = await fetch(cdnUrl, { cache: "no-store" });
const deliveredBody = Buffer.from(await delivered.arrayBuffer());

check("serves the object through the CDN", delivered.ok);
check("returns the bytes unchanged", deliveredBody.equals(payload));
check(
  "keeps the declared content type",
  delivered.headers.get("content-type") === "video/mp4",
  delivered.headers.get("content-type") ?? "",
);

const ranged = await fetch(cdnUrl, { headers: { range: "bytes=0-1023" } });
check("answers range requests", ranged.status === 206, "video seeking");

// --- listing ------------------------------------------------------------

const listed = await api("/api/media/list");
const listedBody = listed.ok ? await listed.json() : { objects: [] };

check(
  "lists the object",
  listedBody.objects?.some((object) => object.key === key),
  `${listedBody.count ?? 0} object(s) in the bucket`,
);

// --- deletion -----------------------------------------------------------

const deleteAnonymous = await api("/api/media/delete", {
  auth: false,
  method: "POST",
  body: JSON.stringify({ keys: [key] }),
});
check("delete without a token", deleteAnonymous.status === 401);

const escaped = await api("/api/media/delete", {
  method: "POST",
  body: JSON.stringify({
    keys: ["../../etc/passwd", "some-other-folder/x.mp4"],
  }),
});
check("refuses keys outside the prefix", escaped.status === 400);

const removed = await api("/api/media/delete", {
  method: "POST",
  body: JSON.stringify({ keys: [key] }),
});
check("deletes the object", removed.status === 200);

// The CDN would still serve it from cache, so ask the bucket instead.
const listedAfter = await api("/api/media/list");
const remaining = listedAfter.ok ? await listedAfter.json() : { objects: [] };

check(
  "the object is gone from the bucket",
  !remaining.objects?.some((object) => object.key === key),
);

// --- summary ------------------------------------------------------------

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);

process.exit(failures === 0 ? 0 : 1);
